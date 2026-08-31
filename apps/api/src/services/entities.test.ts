import { describe, expect, it } from 'vitest'
import { PackRegistry } from '../pack-registry.js'
import { fileURLToPath } from 'node:url'
import { createInMemoryStores, inMemoryUnitOfWork, type InMemoryStores } from '../db/uow.js'
import { EntityService } from './entities.js'
import type { AuthContext } from '../auth.js'

const PACKS_DIR = fileURLToPath(new URL('../../../../packs', import.meta.url))
const auth: AuthContext = { tenantId: 't-demo', actor: 'manager@acme' }

const bankRequest = {
  packKey: 'eaa-accessibility',
  name: 'Acme Bank Online',
  entityIdentifier: 'acme-online',
  entityKind: 'service' as const,
  facts: {
    offeredToConsumersInIE: true,
    serviceType: 'consumer_banking',
    operatorRole: 'provider',
    isMicroEnterprise: false,
    hasWebsite: true,
    hasMobileApp: true,
    hasNonWebSoftware: false,
    providesDownloadableDocuments: false,
    usesSelfServiceTerminals: false,
    disproportionateBurdenClaimed: false,
    fundamentalAlterationClaimed: false,
  },
}

async function setup(): Promise<{ service: EntityService; stores: InMemoryStores }> {
  const registry = await PackRegistry.load(PACKS_DIR)
  const stores = createInMemoryStores()
  const service = new EntityService(inMemoryUnitOfWork(stores), registry)
  return { service, stores }
}

describe('EntityService.create', () => {
  it('writes the entity, an audit event, and an outbox message atomically', async () => {
    const { service, stores } = await setup()
    const result = await service.create(auth, bankRequest, new Date('2026-08-30T12:00:00.000Z'))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(stores.entities.get(result.entity.id)).toBeDefined()

    expect(stores.audit).toHaveLength(1)
    expect(stores.audit[0]).toMatchObject({
      tenantId: 't-demo',
      actorType: 'user',
      actorId: 'manager@acme',
      action: 'entity.created',
      targetType: 'regulated_entity',
      targetId: result.entity.id,
    })
    expect(stores.audit[0]?.metadata).toMatchObject({
      packKey: 'eaa-accessibility',
      evaluationHash: result.evaluation.hash,
    })

    expect(stores.outbox).toHaveLength(1)
    expect(stores.outbox[0]).toMatchObject({
      tenantId: 't-demo',
      topic: 'entity.readiness_evaluated',
      publishedAt: null,
    })
  })

  it('records nothing when the pack is unknown', async () => {
    const { service, stores } = await setup()
    const result = await service.create(auth, { ...bankRequest, packKey: 'nope' })
    expect(result).toMatchObject({ ok: false, code: 'PACK_NOT_FOUND' })
    expect(stores.entities.size).toBe(0)
    expect(stores.audit).toEqual([])
    expect(stores.outbox).toEqual([])
  })

  it('produces a deterministic evaluation hash for identical input', async () => {
    const { service } = await setup()
    const at = new Date('2026-08-30T12:00:00.000Z')
    const a = await service.create(auth, bankRequest, at)
    const b = await service.create(
      { ...auth },
      { ...bankRequest, entityIdentifier: 'acme-online-2' },
      at,
    )
    expect(a.ok && b.ok && a.evaluation.hash === b.evaluation.hash).toBe(true)
  })
})

describe('EntityService.reEvaluate', () => {
  it('re-runs applicability with corrected facts, bumps the version, and diffs the change', async () => {
    const { service, stores } = await setup()
    const created = await service.create(auth, bankRequest)
    if (!created.ok) throw new Error()
    const entityId = created.entity.id

    // adding a claim so we can prove evidence survives a re-evaluation
    stores.claims.push({
      id: 'clm_x',
      tenantId: 't-demo',
      entityId,
      controlKey: 'EAA-EN549-9-1-1-1',
      packKey: 'eaa-accessibility',
      origin: 'INTERNAL_ASSERTION',
      revision: 1,
      supersedesClaimId: null,
      status: 'APPROVED',
      value: 'v',
      unit: null,
      methodContext: null,
      asOfDate: null,
      note: null,
      evidenceUrl: null,
      assertedBy: 'tester',
      assertedAt: '2026-08-31T00:00:00.000Z',
    })

    // the site drops its website — the Web:* controls should stop applying
    const res = await service.reEvaluate(auth, entityId, { facts: { hasWebsite: false } })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.version).toBe(2)
    expect(res.diff.applicabilityChanged.length).toBeGreaterThan(0)
    expect(
      res.diff.applicabilityChanged.some((c) => c.to === 'NOT_APPLICABLE_TO_CLASSIFICATION'),
    ).toBe(true)

    // the claim is untouched, and the entity now points at v2
    expect(stores.claims).toHaveLength(1)
    const cur = await service.matrix(auth, entityId)
    expect(cur?.evaluation.version).toBe(2)
    // the prior evaluation still exists
    expect([...stores.evaluations.values()].filter((e) => e.entityId === entityId)).toHaveLength(2)

    expect(stores.audit.map((a) => a.action)).toContain('entity.re_evaluated')
  })

  it('re-evaluating with no fact change reports an empty diff', async () => {
    const { service } = await setup()
    const created = await service.create(auth, bankRequest)
    if (!created.ok) throw new Error()
    const res = await service.reEvaluate(auth, created.entity.id, {})
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.diff).toMatchObject({ added: [], removed: [], applicabilityChanged: [] })
  })

  it('rejects invalid corrected facts and an unknown entity', async () => {
    const { service } = await setup()
    const created = await service.create(auth, bankRequest)
    if (!created.ok) throw new Error()
    expect(await service.reEvaluate(auth, 'ent_x', {})).toMatchObject({
      ok: false,
      code: 'ENTITY_NOT_FOUND',
    })
    expect(
      await service.reEvaluate(auth, created.entity.id, {
        facts: { offeredToConsumersInIE: 'yes-please' as unknown as boolean },
      }),
    ).toMatchObject({ ok: false, code: 'INVALID_FACTS' })
  })
})
