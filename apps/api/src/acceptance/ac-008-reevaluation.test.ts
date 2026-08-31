/**
 * User-acceptance scenario for AC-008 — readiness re-assessment.
 * Re-running applicability (here, with a corrected scope fact) produces a new
 * evaluation version and a change summary, without discarding approved claims or
 * their evidence.
 */
import { describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app.js'
import { createInMemoryStores, inMemoryUnitOfWork } from '../db/uow.js'
import { bankEntityRequest, type InjectResponse } from './helpers.js'

const CONTROL = 'EAA-EN549-9-1-1-1'
const headers = { 'x-tenant-id': 't-demo', 'x-actor': 'manager@acme' }

describe('AC-008 — readiness re-assessment', () => {
  const withApp = async (fn: (app: FastifyInstance) => Promise<void>): Promise<void> => {
    const app = buildApp({
      logLevel: 'error',
      unitOfWork: inMemoryUnitOfWork(createInMemoryStores()),
    })
    try {
      await fn(app)
    } finally {
      await app.close()
    }
  }

  const json = (r: InjectResponse) => r.json() as Record<string, unknown>

  it('re-evaluates with a corrected fact, versions up, and keeps the claim', async () => {
    await withApp(async (app) => {
      const entityId = (
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/entities',
            headers,
            payload: bankEntityRequest(),
          })
        ).json() as {
          entity: { id: string }
        }
      ).entity.id

      // assert + approve a claim on a Web control
      const claimId = (
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/entities/${entityId}/controls/${CONTROL}/claims`,
            headers,
            payload: { value: 'alt text present' },
          })
        ).json() as { claim: { id: string } }
      ).claim.id
      await app.inject({
        method: 'POST',
        url: `/api/v1/claims/${claimId}/decisions`,
        headers,
        payload: { decision: 'APPROVED' },
      })

      // re-evaluate: the service no longer has a website
      const re = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/re-evaluate`,
        headers,
        payload: { facts: { hasWebsite: false } },
      })
      expect(re.statusCode).toBe(201)
      const body = json(re) as { version: number; diff: { applicabilityChanged: unknown[] } }
      expect(body.version).toBe(2)
      expect(body.diff.applicabilityChanged.length).toBeGreaterThan(0)

      // the matrix is on v2 and the control is no longer required
      const matrix = await app.inject({
        method: 'GET',
        url: `/api/v1/entities/${entityId}/matrix`,
        headers,
      })
      const m = matrix.json() as {
        evaluation: { version: number }
        rows: Array<{ control: string; applicability: string }>
      }
      expect(m.evaluation.version).toBe(2)
      expect(m.rows.find((r) => r.control === CONTROL)?.applicability).toBe(
        'NOT_APPLICABLE_TO_CLASSIFICATION',
      )

      // the claim still exists in the review history
      const audit = await app.inject({ method: 'GET', url: '/api/v1/audit-events', headers })
      const actions = (audit.json() as { events: Array<{ action: string }> }).events.map(
        (e) => e.action,
      )
      expect(actions).toContain('claim.reviewed')
      expect(actions).toContain('entity.re_evaluated')
    })
  })

  it('rejects an invalid corrected fact', async () => {
    await withApp(async (app) => {
      const entityId = (
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/entities',
            headers,
            payload: bankEntityRequest(),
          })
        ).json() as {
          entity: { id: string }
        }
      ).entity.id
      const re = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/re-evaluate`,
        headers,
        payload: { facts: { offeredToConsumersInIE: 'sometimes' } },
      })
      expect(re.statusCode).toBe(422)
      expect(json(re).error).toMatchObject({ code: 'INVALID_FACTS' })
    })
  })
})
