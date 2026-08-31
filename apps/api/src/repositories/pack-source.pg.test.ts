import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import { createPool, migrate } from '@rre/db'
import { PgPackSourceRepository } from './pack-source.pg.js'

const adminUrl = process.env.TEST_DATABASE_URL
const appUrl =
  process.env.TEST_DATABASE_URL_APP ?? adminUrl?.replace(/\/\/[^:]+:[^@]+@/, '//rre_app:rre_app@')
const suite = adminUrl ? describe : describe.skip

const AT = '2026-09-01T00:00:00.000Z'

suite('Postgres pack-source repository (integration)', () => {
  let adminPool: Pool
  let appPool: Pool
  let repo: PgPackSourceRepository

  beforeAll(async () => {
    adminPool = createPool(adminUrl as string)
    await migrate(adminPool)
    appPool = createPool(appUrl as string)
    repo = new PgPackSourceRepository(appPool)
  })

  afterEach(async () => {
    await adminPool.query('TRUNCATE pack_source_check, pack_source_change')
  })

  afterAll(async () => {
    await appPool.end()
    await adminPool.end()
  })

  it('upserts a check, preserving the hash when a later patch omits it', async () => {
    const url = 'https://example.test/a'
    await repo.upsertCheck(url, {
      packKeys: ['p1'],
      status: 'ok',
      hash: 'sha256:one',
      etag: 'W/"1"',
      checkedAt: AT,
    })
    await repo.upsertCheck(url, {
      packKeys: ['p1', 'p2'],
      status: 'error',
      error: 'HTTP 500',
      checkedAt: AT,
    })

    const got = await repo.getCheck(url)
    expect(got).toMatchObject({
      lastHash: 'sha256:one', // preserved
      lastStatus: 'error',
      lastError: 'HTTP 500',
      packKeys: ['p1', 'p2'],
      etag: 'W/"1"',
    })
  })

  it('lists open vs all changes and acknowledges once', async () => {
    for (const id of ['psc_1', 'psc_2']) {
      await repo.insertChange({
        id,
        url: 'https://example.test/b',
        packKeys: ['p1'],
        fromHash: 'sha256:x',
        toHash: `sha256:${id}`,
        detectedAt: AT,
        acknowledgedBy: null,
        acknowledgedAt: null,
      })
    }
    expect(await repo.listChanges()).toHaveLength(2)

    expect(await repo.acknowledge('psc_1', 'ann', AT)).toBe(true)
    expect(await repo.acknowledge('psc_1', 'ann', AT)).toBe(false) // already closed

    expect(await repo.listChanges()).toHaveLength(1)
    expect(await repo.listChanges({ includeAcknowledged: true })).toHaveLength(2)
  })
})
