import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import { createPool, migrate } from '@rre/db'
import { PgPackGovernanceRepository } from './pack-governance.pg.js'

const adminUrl = process.env.TEST_DATABASE_URL
const appUrl =
  process.env.TEST_DATABASE_URL_APP ?? adminUrl?.replace(/\/\/[^:]+:[^@]+@/, '//rre_app:rre_app@')
const suite = adminUrl ? describe : describe.skip

const AT = '2026-09-01T00:00:00.000Z'

suite('Postgres pack-governance repository (integration)', () => {
  let adminPool: Pool
  let appPool: Pool
  let repo: PgPackGovernanceRepository

  beforeAll(async () => {
    adminPool = createPool(adminUrl as string)
    await migrate(adminPool)
    appPool = createPool(appUrl as string)
    repo = new PgPackGovernanceRepository(appPool)
  })

  afterEach(async () => {
    await adminPool.query('TRUNCATE pack_review, pack_activation')
  })

  afterAll(async () => {
    await appPool.end()
    await adminPool.end()
  })

  it('dedupes reviews on (pack, checksum, reviewer) and lists them per checksum', async () => {
    const base = {
      packKey: 'p1',
      checksum: 'sha256:aaa',
      reviewer: 'ann',
      note: null,
      createdAt: AT,
    }
    await repo.addReview({ id: 'prv_1', ...base })
    await repo.addReview({ id: 'prv_2', ...base }) // duplicate reviewer/checksum → no-op
    await repo.addReview({ id: 'prv_3', ...base, reviewer: 'ben' })
    await repo.addReview({ id: 'prv_4', ...base, checksum: 'sha256:bbb' })

    const forA = await repo.listReviews('p1', 'sha256:aaa')
    expect(forA.map((r) => r.reviewer).sort()).toEqual(['ann', 'ben'])
    expect(await repo.listReviews('p1', 'sha256:bbb')).toHaveLength(1)
  })

  it('upserts a single activation per pack and reads it back', async () => {
    await repo.upsertActivation({
      packKey: 'p1',
      checksum: 'sha256:aaa',
      status: 'active',
      activatedBy: 'ops',
      activatedAt: AT,
      withdrawnBy: null,
      withdrawnAt: null,
    })
    await repo.upsertActivation({
      packKey: 'p1',
      checksum: 'sha256:aaa',
      status: 'withdrawn',
      activatedBy: 'ops',
      activatedAt: AT,
      withdrawnBy: 'ops',
      withdrawnAt: '2026-09-02T00:00:00.000Z',
    })

    const got = await repo.getActivation('p1')
    expect(got).toMatchObject({ status: 'withdrawn', withdrawnBy: 'ops' })
    expect(await repo.getActivation('p2')).toBeNull()
  })
})
