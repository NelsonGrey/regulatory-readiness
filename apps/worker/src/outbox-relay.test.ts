import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'
import { createPool, migrate } from '@rre/db'
import { relayOnce } from './outbox-relay.js'
import type { OutboxMessage } from './sqs.js'

const baseUrl = process.env.TEST_DATABASE_URL
const RELAY_DB = 'rre_relay_test'

// Runs in its own disposable database so it cannot race the api Postgres tests.
const suite = baseUrl ? describe : describe.skip

function swapDatabase(url: string, db: string): string {
  return url.replace(/\/[^/?]+(\?.*)?$/, `/${db}$1`)
}
function swapUser(url: string, user: string, password: string): string {
  return url.replace(/\/\/[^:]+:[^@]+@/, `//${user}:${password}@`)
}

suite('outbox relay (integration)', () => {
  let adminPool: Pool
  let relayPool: Pool

  beforeAll(async () => {
    const maint = createPool(baseUrl as string)
    await maint.query(`DROP DATABASE IF EXISTS ${RELAY_DB} WITH (FORCE)`)
    await maint.query(`CREATE DATABASE ${RELAY_DB}`)
    await maint.end()

    const relayDbUrl = swapDatabase(baseUrl as string, RELAY_DB)
    adminPool = createPool(relayDbUrl)
    await migrate(adminPool)
    relayPool = createPool(swapUser(relayDbUrl, 'rre_relay', 'rre_relay'))
  })

  afterAll(async () => {
    await relayPool.end()
    await adminPool.end()
    const maint = createPool(baseUrl as string)
    await maint.query(`DROP DATABASE IF EXISTS ${RELAY_DB} WITH (FORCE)`)
    await maint.end()
  })

  beforeEach(async () => {
    await adminPool.query('TRUNCATE outbox')
  })

  const seed = (id: string, tenantId: string) =>
    adminPool.query(
      `INSERT INTO outbox (id, tenant_id, topic, payload)
       VALUES ($1, $2, 'entity.readiness_evaluated', $3::jsonb)`,
      [id, tenantId, JSON.stringify({ entityId: id })],
    )

  it('publishes every unpublished row (across tenants — BYPASSRLS) and marks it published', async () => {
    await seed('obx_a', 't-alpha')
    await seed('obx_b', 't-alpha')
    await seed('obx_c', 't-bravo')

    const seen: OutboxMessage[] = []
    const result = await relayOnce({
      pool: relayPool,
      publish: async (m) => {
        seen.push(m)
      },
    })

    expect(result).toEqual({ published: 3, failed: 0 })
    expect(seen.map((m) => m.id).sort()).toEqual(['obx_a', 'obx_b', 'obx_c'])
    expect(seen.map((m) => m.tenantId).sort()).toEqual(['t-alpha', 't-alpha', 't-bravo'])

    const unpublished = await adminPool.query(
      'SELECT count(*)::int AS n FROM outbox WHERE published_at IS NULL',
    )
    expect(unpublished.rows[0].n).toBe(0)
  })

  it('bumps attempts and leaves the row unpublished when publishing fails, then retries', async () => {
    await seed('obx_x', 't-alpha')

    const failing = await relayOnce({
      pool: relayPool,
      publish: vi.fn().mockRejectedValue(new Error('sqs down')),
    })
    expect(failing).toEqual({ published: 0, failed: 1 })

    const afterFail = await adminPool.query(
      'SELECT attempts, published_at FROM outbox WHERE id = $1',
      ['obx_x'],
    )
    expect(afterFail.rows[0].attempts).toBe(1)
    expect(afterFail.rows[0].published_at).toBeNull()

    const retry = await relayOnce({ pool: relayPool, publish: async () => {} })
    expect(retry).toEqual({ published: 1, failed: 0 })

    const afterRetry = await adminPool.query('SELECT published_at FROM outbox WHERE id = $1', [
      'obx_x',
    ])
    expect(afterRetry.rows[0].published_at).not.toBeNull()
  })

  it('is a no-op when there is nothing to publish', async () => {
    expect(await relayOnce({ pool: relayPool, publish: async () => {} })).toEqual({
      published: 0,
      failed: 0,
    })
  })

  it('cannot rewrite payload or topic (column-level grant)', async () => {
    await seed('obx_y', 't-alpha')
    await expect(
      relayPool.query(`UPDATE outbox SET topic = 'evil' WHERE id = 'obx_y'`),
    ).rejects.toThrow(/permission denied/i)
  })
})
