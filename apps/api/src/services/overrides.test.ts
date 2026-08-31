import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { PackRegistry } from '../pack-registry.js'
import { createInMemoryStores, inMemoryUnitOfWork, type InMemoryStores } from '../db/uow.js'
import { EntityService } from './entities.js'
import { OverrideService } from './overrides.js'
import type { AuthContext } from '../auth.js'
import { bankEntityRequest } from '../acceptance/helpers.js'

const PACKS_DIR = fileURLToPath(new URL('../../../../packs', import.meta.url))
const auth: AuthContext = { tenantId: 't-demo', actor: 'approver@acme' }
const REQUIRED = 'EAA-EN549-9-2-1-1'
const NOT_APPLICABLE = 'EAA-EN549-10-1-1-1'

async function setup(): Promise<{
  entities: EntityService
  overrides: OverrideService
  stores: InMemoryStores
  entityId: string
}> {
  const registry = await PackRegistry.load(PACKS_DIR)
  const stores = createInMemoryStores()
  const uow = inMemoryUnitOfWork(stores)
  const entities = new EntityService(uow, registry)
  const created = await entities.create(auth, bankEntityRequest())
  if (!created.ok) throw new Error('setup failed')
  return {
    entities,
    overrides: new OverrideService(uow, registry),
    stores,
    entityId: created.entity.id,
  }
}

const readinessOf = async (
  ctx: Awaited<ReturnType<typeof setup>>,
  control: string,
  now?: Date,
): Promise<{ applicability?: string; readiness?: string; entityStatus?: string }> => {
  const m = await ctx.entities.matrix(auth, ctx.entityId, now)
  const row = m?.rows.find((r) => r.control === control)
  return {
    applicability: row?.applicability,
    readiness: row?.readiness,
    entityStatus: m?.entityStatus,
  }
}

describe('OverrideService', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => {
    ctx = await setup()
  })

  it('rejects an unknown entity, control, or result', async () => {
    expect(
      await ctx.overrides.record(auth, 'ent_x', REQUIRED, {
        result: 'NOT_APPLICABLE_TO_CLASSIFICATION',
        rationale: 'x',
      }),
    ).toMatchObject({ ok: false, code: 'ENTITY_NOT_FOUND' })
    expect(
      await ctx.overrides.record(auth, ctx.entityId, 'BOGUS', {
        result: 'NOT_APPLICABLE_TO_CLASSIFICATION',
        rationale: 'x',
      }),
    ).toMatchObject({ ok: false, code: 'UNKNOWN_CONTROL' })
    expect(
      await ctx.overrides.record(auth, ctx.entityId, REQUIRED, {
        result: 'NOPE' as unknown as 'REQUIRED_BY_SNAPSHOT',
        rationale: 'x',
      }),
    ).toMatchObject({ ok: false, code: 'BAD_RESULT' })
  })

  it('overriding a required control to not-applicable removes it as a blocker', async () => {
    expect((await readinessOf(ctx, REQUIRED)).applicability).toBe('REQUIRED_BY_SNAPSHOT')

    const res = await ctx.overrides.record(auth, ctx.entityId, REQUIRED, {
      result: 'NOT_APPLICABLE_TO_CLASSIFICATION',
      rationale: 'the keyboard requirement is covered by a certified hardware component',
    })
    expect(res.ok).toBe(true)

    const after = await readinessOf(ctx, REQUIRED)
    expect(after.applicability).toBe('NOT_APPLICABLE_TO_CLASSIFICATION')
    expect(after.readiness).toBe('NOT_APPLICABLE')
    expect(ctx.stores.audit.map((a) => a.action)).toContain('applicability.overridden')
  })

  it('overriding a not-applicable control to required adds a MISSING gap', async () => {
    expect((await readinessOf(ctx, NOT_APPLICABLE)).readiness).toBe('NOT_APPLICABLE')
    await ctx.overrides.record(auth, ctx.entityId, NOT_APPLICABLE, {
      result: 'REQUIRED_BY_SNAPSHOT',
      rationale: 'this service does offer downloadable statements after all',
    })
    const after = await readinessOf(ctx, NOT_APPLICABLE)
    expect(after.applicability).toBe('REQUIRED_BY_SNAPSHOT')
    expect(after.readiness).toBe('MISSING')
  })

  it('ignores an expired override and honours a revoked one being withdrawn', async () => {
    const res = await ctx.overrides.record(
      auth,
      ctx.entityId,
      REQUIRED,
      {
        result: 'NOT_APPLICABLE_TO_CLASSIFICATION',
        rationale: 'temporary, review soon',
        expiresAt: '2026-01-01T00:00:00.000Z',
      },
      new Date('2025-06-01T00:00:00.000Z'),
    )
    if (!res.ok) throw new Error()

    // before expiry
    expect(
      (await readinessOf(ctx, REQUIRED, new Date('2025-12-01T00:00:00.000Z'))).applicability,
    ).toBe('NOT_APPLICABLE_TO_CLASSIFICATION')
    // after expiry — back to the evaluated result
    expect(
      (await readinessOf(ctx, REQUIRED, new Date('2026-02-01T00:00:00.000Z'))).applicability,
    ).toBe('REQUIRED_BY_SNAPSHOT')

    // a fresh (non-expiring) override, then revoked
    const live = await ctx.overrides.record(auth, ctx.entityId, REQUIRED, {
      result: 'NOT_APPLICABLE_TO_CLASSIFICATION',
      rationale: 'covered elsewhere',
    })
    if (!live.ok) throw new Error()
    expect((await readinessOf(ctx, REQUIRED)).applicability).toBe(
      'NOT_APPLICABLE_TO_CLASSIFICATION',
    )

    expect(await ctx.overrides.revoke(auth, live.override.id)).toMatchObject({ ok: true })
    expect(await ctx.overrides.revoke(auth, live.override.id)).toMatchObject({
      ok: false,
      code: 'ALREADY_REVOKED',
    })
    expect((await readinessOf(ctx, REQUIRED)).applicability).toBe('REQUIRED_BY_SNAPSHOT')
  })
})
