import { describe, expect, it } from 'vitest'
import type { EntityScopeEvaluation, RegulatedEntity } from '@rre/domain'
import { createInMemoryStores, inMemoryUnitOfWork } from './uow.js'

const entity = (tenantId: string, id: string): RegulatedEntity => ({
  id,
  tenantId,
  packKey: 'p',
  name: 'n',
  entityIdentifier: `id-${id}`,
  entityKind: 'service',
  createdAt: '2026-08-30T12:00:00.000Z',
  createdBy: 'u',
  currentEvaluationId: `${id}-eval`,
})

const evaluation = (tenantId: string, id: string): EntityScopeEvaluation => ({
  id: `${id}-eval`,
  entityId: id,
  tenantId,
  packKey: 'p',
  snapshotKey: 's',
  version: 1,
  facts: {},
  results: [],
  evaluatedAt: '2026-08-30T12:00:00.000Z',
  evaluatedBy: 'u',
  hash: 'sha256:x',
})

describe('inMemoryUnitOfWork', () => {
  it('flushes entity + audit + outbox together on success', async () => {
    const stores = createInMemoryStores()
    const uow = inMemoryUnitOfWork(stores)

    await uow('t-a', async (u) => {
      await u.entities.create(entity('t-a', 'e1'), evaluation('t-a', 'e1'))
      await u.audit({
        actorType: 'user',
        actorId: 'u',
        action: 'entity.created',
        targetType: 'regulated_entity',
        targetId: 'e1',
        occurredAt: '2026-08-30T12:00:00.000Z',
      })
      await u.enqueue('entity.readiness_evaluated', { entityId: 'e1' })
    })

    expect(stores.entities.has('e1')).toBe(true)
    expect(stores.audit).toHaveLength(1)
    expect(stores.audit[0]).toMatchObject({
      tenantId: 't-a',
      action: 'entity.created',
      targetId: 'e1',
    })
    expect(stores.outbox).toHaveLength(1)
    expect(stores.outbox[0]).toMatchObject({
      topic: 'entity.readiness_evaluated',
      publishedAt: null,
    })
  })

  it('discards the whole batch when the callback throws (atomic)', async () => {
    const stores = createInMemoryStores()
    const uow = inMemoryUnitOfWork(stores)

    await expect(
      uow('t-a', async (u) => {
        await u.entities.create(entity('t-a', 'e1'), evaluation('t-a', 'e1'))
        await u.audit({
          actorType: 'user',
          actorId: 'u',
          action: 'entity.created',
          targetType: 'regulated_entity',
          targetId: 'e1',
          occurredAt: '2026-08-30T12:00:00.000Z',
        })
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    expect(stores.entities.size).toBe(0)
    expect(stores.audit).toEqual([])
    expect(stores.outbox).toEqual([])
  })

  it('rejects a write whose tenant does not match the unit of work', async () => {
    const stores = createInMemoryStores()
    const uow = inMemoryUnitOfWork(stores)
    await expect(
      uow('t-a', async (u) => {
        await u.entities.create(entity('t-b', 'e1'), evaluation('t-b', 'e1'))
      }),
    ).rejects.toThrow(/tenant mismatch/)
    expect(stores.entities.size).toBe(0)
  })

  it('reads back an entity staged earlier in the same unit of work', async () => {
    const stores = createInMemoryStores()
    const uow = inMemoryUnitOfWork(stores)
    const found = await uow('t-a', async (u) => {
      await u.entities.create(entity('t-a', 'e1'), evaluation('t-a', 'e1'))
      return u.entities.get('e1')
    })
    expect(found?.entity.id).toBe('e1')
  })
})
