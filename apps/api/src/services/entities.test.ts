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
