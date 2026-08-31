import { beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp } from '../acceptance/helpers.js'
import { createInMemoryStores, inMemoryUnitOfWork, type InMemoryStores } from '../db/uow.js'
import { bankEntityRequest } from '../acceptance/helpers.js'

describe('GET /api/v1/audit-events', () => {
  let app: FastifyInstance
  let stores: InMemoryStores

  beforeEach(async () => {
    stores = createInMemoryStores()
    app = buildTestApp({ logLevel: 'error', unitOfWork: inMemoryUnitOfWork(stores) })
  })

  const createEntity = (tenant = 't-alpha', identifier = 'e-1') =>
    app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      headers: { 'x-tenant-id': tenant, 'x-actor': 'manager@acme' },
      payload: { ...bankEntityRequest(), entityIdentifier: identifier },
    })

  it('returns the entity.created event for the acting tenant', async () => {
    const created = await createEntity()
    const entityId = (created.json() as { entity: { id: string } }).entity.id

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit-events',
      headers: { 'x-tenant-id': 't-alpha' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      events: Array<{ action: string; targetId: string; actorId: string; metadata: unknown }>
      nextBefore: string | null
    }
    expect(body.events).toHaveLength(1)
    expect(body.events[0]).toMatchObject({
      action: 'entity.created',
      targetId: entityId,
      actorId: 'manager@acme',
      targetType: 'regulated_entity',
    })
    expect(body.nextBefore).toBeNull()
  })

  it('filters by action and target, and paginates with before', async () => {
    await createEntity('t-alpha', 'e-1')
    await createEntity('t-alpha', 'e-2')
    await createEntity('t-alpha', 'e-3')

    const firstPage = await app.inject({
      method: 'GET',
      url: '/api/v1/audit-events?action=entity.created&limit=2',
      headers: { 'x-tenant-id': 't-alpha' },
    })
    const p1 = firstPage.json() as { events: Array<{ seq: string }>; nextBefore: string | null }
    expect(p1.events).toHaveLength(2)
    expect(p1.nextBefore).not.toBeNull()

    const secondPage = await app.inject({
      method: 'GET',
      url: `/api/v1/audit-events?limit=2&before=${p1.nextBefore}`,
      headers: { 'x-tenant-id': 't-alpha' },
    })
    const p2 = secondPage.json() as { events: Array<{ seq: string }>; nextBefore: string | null }
    expect(p2.events).toHaveLength(1)
    expect(p2.nextBefore).toBeNull()
    expect(Number(p2.events[0]!.seq)).toBeLessThan(Number(p1.events[1]!.seq))
  })

  it('does not disclose another tenant’s audit trail', async () => {
    await createEntity('t-alpha', 'e-1')
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/audit-events',
      headers: { 'x-tenant-id': 't-bravo' },
    })
    expect((res.json() as { events: unknown[] }).events).toEqual([])
  })

  it('401s without a tenant header and 422s on a non-integer limit', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/audit-events' })).statusCode).toBe(401)
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/v1/audit-events?limit=abc',
          headers: { 'x-tenant-id': 't-alpha' },
        })
      ).statusCode,
    ).toBe(422)
  })
})
