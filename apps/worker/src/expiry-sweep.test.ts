import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import { createPool, migrate } from '@rre/db'
import { sweepExpiredRequests } from './expiry-sweep.js'

const baseUrl = process.env.TEST_DATABASE_URL
const SWEEP_DB = 'rre_expiry_test'

// Runs in its own disposable database so it cannot race the api Postgres tests.
const suite = baseUrl ? describe : describe.skip

function swapDatabase(url: string, db: string): string {
  return url.replace(/\/[^/?]+(\?.*)?$/, `/${db}$1`)
}
function swapUser(url: string, user: string, password: string): string {
  return url.replace(/\/\/[^:]+:[^@]+@/, `//${user}:${password}@`)
}

const AT = '2026-08-31T12:00:00.000Z'
const PAST = '2026-08-01T00:00:00.000Z'
const FUTURE = '2099-01-01T00:00:00.000Z'

suite('request expiry sweep (integration)', () => {
  let adminPool: Pool
  let appPool: Pool

  beforeAll(async () => {
    const maint = createPool(baseUrl as string)
    await maint.query(`DROP DATABASE IF EXISTS ${SWEEP_DB} WITH (FORCE)`)
    await maint.query(`CREATE DATABASE ${SWEEP_DB}`)
    await maint.end()

    const dbUrl = swapDatabase(baseUrl as string, SWEEP_DB)
    adminPool = createPool(dbUrl)
    await migrate(adminPool)
    // The sweep runs as rre_app; the transition itself is a SECURITY DEFINER function.
    appPool = createPool(swapUser(dbUrl, 'rre_app', 'rre_app'))
  })

  afterAll(async () => {
    await appPool.end()
    await adminPool.end()
    const maint = createPool(baseUrl as string)
    await maint.query(`DROP DATABASE IF EXISTS ${SWEEP_DB} WITH (FORCE)`)
    await maint.end()
  })

  beforeEach(async () => {
    await adminPool.query(`TRUNCATE evidence_request, access_token_grant, audit_event, outbox`)
  })

  const request = (id: string, tenantId: string, status: string) =>
    adminPool.query(
      `INSERT INTO evidence_request
         (id, tenant_id, entity_id, pack_key, status, created_by, created_at)
       VALUES ($1, $2, $3, 'eaa-accessibility', $4, 'tester', $5)`,
      [id, tenantId, `${id}-entity`, status, AT],
    )

  const grant = (
    id: string,
    requestId: string,
    tenantId: string,
    expiresAt: string,
    revoked = false,
  ) =>
    adminPool.query(
      `INSERT INTO access_token_grant
         (id, tenant_id, request_id, token_prefix, token_hash, expires_at, revoked_at, created_at)
       VALUES ($1, $2, $3, $4, $4, $5, $6, $7)`,
      [id, tenantId, requestId, id.slice(0, 8), expiresAt, revoked ? PAST : null, AT],
    )

  it('expires only lapsed non-terminal requests, and writes the audit + outbox trail', async () => {
    await request('req_lapsed', 't-alpha', 'SENT')
    await grant('tkn_lapsed', 'req_lapsed', 't-alpha', PAST)

    await request('req_live', 't-alpha', 'SENT')
    await grant('tkn_live', 'req_live', 't-alpha', FUTURE)

    await request('req_revoked_only', 't-bravo', 'IN_PROGRESS')
    await grant('tkn_r', 'req_revoked_only', 't-bravo', FUTURE, true)

    await request('req_no_grant', 't-bravo', 'DRAFT')

    await request('req_closed', 't-alpha', 'CLOSED')
    await grant('tkn_closed', 'req_closed', 't-alpha', PAST)

    const first = await sweepExpiredRequests({ pool: appPool, now: () => new Date(AT) })
    expect(first.expired).toBe(3)

    const statuses = Object.fromEntries(
      (await adminPool.query(`SELECT id, status FROM evidence_request ORDER BY id`)).rows.map(
        (r: { id: string; status: string }) => [r.id, r.status],
      ),
    )
    expect(statuses).toEqual({
      req_closed: 'CLOSED',
      req_lapsed: 'EXPIRED',
      req_live: 'SENT',
      req_no_grant: 'EXPIRED',
      req_revoked_only: 'EXPIRED',
    })

    const audit = await adminPool.query(
      `SELECT tenant_id, target_id FROM audit_event WHERE action = 'request.expired' ORDER BY target_id`,
    )
    expect(audit.rows).toEqual([
      { tenant_id: 't-alpha', target_id: 'req_lapsed' },
      { tenant_id: 't-bravo', target_id: 'req_no_grant' },
      { tenant_id: 't-bravo', target_id: 'req_revoked_only' },
    ])

    const outbox = await adminPool.query(
      `SELECT topic, count(*)::int AS n FROM outbox GROUP BY topic`,
    )
    expect(outbox.rows).toEqual([{ topic: 'request.expired', n: 3 }])

    // Idempotent — nothing left to do.
    const second = await sweepExpiredRequests({ pool: appPool, now: () => new Date(AT) })
    expect(second.expired).toBe(0)
  })
})
