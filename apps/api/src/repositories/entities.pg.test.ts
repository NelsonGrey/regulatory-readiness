import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import type { EntityScopeEvaluation, RegulatedEntity } from '@rre/domain'
import { createPool, withTenant } from '../db/pool.js'
import { migrate } from '../db/migrate.js'
import { PgEntityRepository } from './entities.pg.js'

const adminUrl = process.env.TEST_DATABASE_URL
// The app connects as the non-superuser `rre_app` role (migration 0002) so RLS
// is actually enforced. Derive its URL from the admin URL unless overridden.
const appUrl =
  process.env.TEST_DATABASE_URL_APP ?? adminUrl?.replace(/\/\/[^:]+:[^@]+@/, '//rre_app:rre_app@')

const suite = adminUrl ? describe : describe.skip

suite('PgEntityRepository (integration)', () => {
  let adminPool: Pool
  let pool: Pool
  let repo: PgEntityRepository

  const makeEntity = (tenantId: string, id: string): RegulatedEntity => ({
    id,
    tenantId,
    packKey: 'eaa-accessibility',
    name: `Entity ${id}`,
    entityIdentifier: `id-${id}`,
    entityKind: 'service',
    createdAt: new Date('2026-08-30T12:00:00.000Z').toISOString(),
    createdBy: 'tester',
    currentEvaluationId: `${id}-eval`,
  })

  const makeEvaluation = (tenantId: string, id: string): EntityScopeEvaluation => ({
    id: `${id}-eval`,
    entityId: id,
    tenantId,
    packKey: 'eaa-accessibility',
    snapshotKey: 'SNAP-1',
    version: 1,
    facts: { hasWebsite: true, entityKind: 'service' },
    results: [{ control: 'C-1', result: 'REQUIRED_BY_SNAPSHOT' }],
    evaluatedAt: new Date('2026-08-30T12:00:00.000Z').toISOString(),
    evaluatedBy: 'tester',
    hash: 'sha256:deadbeef',
  })

  beforeAll(async () => {
    adminPool = createPool(adminUrl as string)
    await migrate(adminPool)
    await adminPool.query('TRUNCATE regulated_entity, entity_scope_evaluation')

    pool = createPool(appUrl as string)
    repo = new PgEntityRepository(pool)
    await repo.create(makeEntity('t-alpha', 'e1'), makeEvaluation('t-alpha', 'e1'))
  })

  afterAll(async () => {
    await adminPool.query('TRUNCATE regulated_entity, entity_scope_evaluation')
    await pool.end()
    await adminPool.end()
  })

  it('round-trips an entity + evaluation for its own tenant', async () => {
    const got = await repo.get('t-alpha', 'e1')
    expect(got?.entity.name).toBe('Entity e1')
    expect(got?.entity.entityKind).toBe('service')
    expect(got?.evaluation.results[0]?.control).toBe('C-1')
    expect(got?.evaluation.facts).toEqual({ hasWebsite: true, entityKind: 'service' })
  })

  it('does not return an entity to another tenant', async () => {
    expect(await repo.get('t-bravo', 'e1')).toBeNull()
  })

  it('RLS blocks a raw cross-tenant SELECT with no WHERE clause', async () => {
    const otherTenantRows = await withTenant(
      pool,
      't-bravo',
      async (c) => (await c.query('SELECT id FROM regulated_entity')).rows,
    )
    expect(otherTenantRows).toEqual([])

    const ownRows = await withTenant(
      pool,
      't-alpha',
      async (c) => (await c.query<{ id: string }>('SELECT id FROM regulated_entity')).rows,
    )
    expect(ownRows.map((r) => r.id)).toContain('e1')
  })

  it('RLS WITH CHECK rejects an insert whose tenant_id != the session tenant', async () => {
    await expect(
      withTenant(pool, 't-alpha', (c) =>
        c.query(
          `INSERT INTO regulated_entity
             (id, tenant_id, pack_key, name, entity_identifier, entity_kind,
              created_at, created_by, current_evaluation_id)
           VALUES ('bad','t-bravo','eaa-accessibility','x','bad-id','service', now(),'u','x')`,
        ),
      ),
    ).rejects.toThrow()
  })
})
