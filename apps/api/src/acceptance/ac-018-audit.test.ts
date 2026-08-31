/**
 * User-acceptance scenario for AC-018 — audit reconstruction.
 * Given an entity-to-matrix journey, an authorized user can reconstruct who
 * changed what and when, and tokens / document content are never present.
 */
import { describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createInMemoryStores, inMemoryUnitOfWork } from '../db/uow.js'
import { bankEntityRequest, getMatrix, buildTestApp } from './helpers.js'

describe('AC-018 — audit reconstruction', () => {
  let app: FastifyInstance

  const withApp = async (fn: (app: FastifyInstance) => Promise<void>): Promise<void> => {
    app = buildTestApp({
      logLevel: 'error',
      unitOfWork: inMemoryUnitOfWork(createInMemoryStores()),
    })
    try {
      await fn(app)
    } finally {
      await app.close()
    }
  }

  it('records a reconstructable entity.created event and leaks no secrets', async () => {
    await withApp(async (app) => {
      // Given a manager creates an entity and views its matrix
      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/entities',
        headers: { 'x-tenant-id': 't-demo', 'x-actor': 'manager@acme' },
        payload: bankEntityRequest(),
      })
      const { entity, evaluation } = created.json() as {
        entity: { id: string }
        evaluation: { hash: string }
      }
      await getMatrix(app, entity.id)

      // When an authorized user reads the audit trail
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/audit-events',
        headers: { 'x-tenant-id': 't-demo' },
      })
      expect(res.statusCode).toBe(200)
      const { events } = res.json() as {
        events: Array<Record<string, unknown> & { metadata: Record<string, unknown> }>
      }

      // Then the who / what / when / against-what is reconstructable
      const createdEvent = events.find((e) => e.action === 'entity.created')
      expect(createdEvent).toMatchObject({
        actorType: 'user',
        actorId: 'manager@acme',
        targetType: 'regulated_entity',
        targetId: entity.id,
      })
      expect(new Date(String(createdEvent!.occurredAt)).toISOString()).toBe(
        createdEvent!.occurredAt,
      )
      expect(createdEvent!.metadata).toMatchObject({
        packKey: 'eaa-accessibility',
        evaluationHash: evaluation.hash,
      })

      // And no token / credential / raw request body is present anywhere
      const raw = res.body.toLowerCase()
      for (const banned of ['x-tenant-id', 'authorization', 'password', 'secret', 'bearer']) {
        expect(raw).not.toContain(banned)
      }
    })
  })
})
