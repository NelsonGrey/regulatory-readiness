/**
 * User-acceptance scenario for AC-010 — human claim decision.
 * Given an unreviewed proposal, an authorized approver approves / rejects /
 * supersedes with reasons enforced and history preserved.
 */
import { describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createInMemoryStores, inMemoryUnitOfWork } from '../db/uow.js'
import { bankEntityRequest, type InjectResponse, buildTestApp } from './helpers.js'

const CONTROL = 'EAA-EN549-9-2-1-1'

describe('AC-010 — human claim decision', () => {
  const withApp = async (fn: (app: FastifyInstance) => Promise<void>): Promise<void> => {
    const app = buildTestApp({
      logLevel: 'error',
      unitOfWork: inMemoryUnitOfWork(createInMemoryStores()),
    })
    try {
      await fn(app)
    } finally {
      await app.close()
    }
  }

  const headers = { 'x-tenant-id': 't-demo', 'x-actor': 'approver@acme' }

  async function createEntity(app: FastifyInstance): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      headers,
      payload: bankEntityRequest(),
    })
    return (res.json() as { entity: { id: string } }).entity.id
  }

  const assert = (app: FastifyInstance, id: string, value: string): Promise<InjectResponse> =>
    app.inject({
      method: 'POST',
      url: `/api/v1/entities/${id}/controls/${CONTROL}/claims`,
      headers,
      payload: { value },
    })

  const decide = (app: FastifyInstance, claimId: string, body: unknown): Promise<InjectResponse> =>
    app.inject({
      method: 'POST',
      url: `/api/v1/claims/${claimId}/decisions`,
      headers,
      payload: body as Record<string, unknown>,
    })

  it('a proposal is PENDING_REVIEW; approval evidences the control; the decision is audited', async () => {
    await withApp(async (app) => {
      const id = await createEntity(app)

      const asserted = await assert(app, id, 'keyboard operable')
      expect(asserted.statusCode).toBe(201)
      const claimId = (asserted.json() as { claim: { id: string; status: string } }).claim.id

      // it shows on the review queue and as PENDING_REVIEW on the matrix
      const queue = await app.inject({
        method: 'GET',
        url: `/api/v1/entities/${id}/review-queue`,
        headers,
      })
      expect((queue.json() as { items: unknown[] }).items).toHaveLength(1)

      const before = await app.inject({
        method: 'GET',
        url: `/api/v1/entities/${id}/matrix`,
        headers,
      })
      const beforeRow = (
        before.json() as { rows: Array<{ control: string; readiness: string }> }
      ).rows.find((r) => r.control === CONTROL)
      expect(beforeRow?.readiness).toBe('PENDING_REVIEW')

      const approved = await decide(app, claimId, { decision: 'APPROVED' })
      expect(approved.statusCode).toBe(200)
      expect((approved.json() as { claim: { status: string } }).claim.status).toBe('APPROVED')

      const after = await app.inject({
        method: 'GET',
        url: `/api/v1/entities/${id}/matrix`,
        headers,
      })
      const afterRow = (
        after.json() as {
          rows: Array<{ control: string; readiness: string; approvedValue: string | null }>
        }
      ).rows.find((r) => r.control === CONTROL)
      // approved, but no supporting document yet
      expect(afterRow?.readiness).toBe('SELF_ATTESTED')
      expect(afterRow?.approvedValue).toBe('keyboard operable')

      const audit = await app.inject({ method: 'GET', url: '/api/v1/audit-events', headers })
      const actions = (audit.json() as { events: Array<{ action: string }> }).events.map(
        (e) => e.action,
      )
      expect(actions).toContain('claim.asserted')
      expect(actions).toContain('claim.reviewed')
    })
  })

  it('a self-attested control becomes EVIDENCED once a supporting document is linked', async () => {
    await withApp(async (app) => {
      const id = await createEntity(app)
      const claimId = (
        (await assert(app, id, 'keyboard operable')).json() as {
          claim: { id: string }
        }
      ).claim.id
      await decide(app, claimId, { decision: 'APPROVED' })

      const readiness = async (): Promise<string | undefined> => {
        const m = await app.inject({ method: 'GET', url: `/api/v1/entities/${id}/matrix`, headers })
        return (m.json() as { rows: Array<{ control: string; readiness: string }> }).rows.find(
          (r) => r.control === CONTROL,
        )?.readiness
      }
      expect(await readiness()).toBe('SELF_ATTESTED')

      // upload a document
      const started = await app.inject({
        method: 'POST',
        url: '/api/v1/documents',
        headers,
        payload: {
          filename: 'audit.pdf',
          mediaType: 'application/pdf',
          sizeBytes: 12,
          entityId: id,
        },
      })
      const { documentId, uploadUrl } = started.json() as { documentId: string; uploadUrl: string }
      await app.inject({
        method: 'PUT',
        url: uploadUrl,
        headers: { ...headers, 'content-type': 'application/octet-stream' },
        payload: Buffer.from('%PDF-1.4 xyz'),
      })
      await app.inject({ method: 'POST', url: `/api/v1/documents/${documentId}/finalize`, headers })

      const linked = await app.inject({
        method: 'POST',
        url: `/api/v1/claims/${claimId}/evidence`,
        headers,
        payload: { documentId, page: 2, quote: 'keyboard operable' },
      })
      expect(linked.statusCode).toBe(201)
      expect(await readiness()).toBe('EVIDENCED')
    })
  })

  it('rejection requires a reason and does not discard the claim record', async () => {
    await withApp(async (app) => {
      const id = await createEntity(app)
      const claimId = ((await assert(app, id, 'maybe')).json() as { claim: { id: string } }).claim
        .id

      expect((await decide(app, claimId, { decision: 'REJECTED' })).statusCode).toBe(422)

      const rejected = await decide(app, claimId, { decision: 'REJECTED', reason: 'not evidenced' })
      expect(rejected.statusCode).toBe(200)
      expect((rejected.json() as { claim: { status: string } }).claim.status).toBe('REJECTED')

      // deciding again on a non-pending claim is a conflict
      expect((await decide(app, claimId, { decision: 'APPROVED' })).statusCode).toBe(409)

      const matrix = await app.inject({
        method: 'GET',
        url: `/api/v1/entities/${id}/matrix`,
        headers,
      })
      expect(
        (matrix.json() as { rows: Array<{ control: string; readiness: string }> }).rows.find(
          (r) => r.control === CONTROL,
        )?.readiness,
      ).toBe('MISSING')
    })
  })

  it('does not label the entity evidence-ready while required controls are unmet', async () => {
    await withApp(async (app) => {
      const id = await createEntity(app)
      const claimId = ((await assert(app, id, 'x')).json() as { claim: { id: string } }).claim.id
      await decide(app, claimId, { decision: 'APPROVED' })

      const matrix = await app.inject({
        method: 'GET',
        url: `/api/v1/entities/${id}/matrix`,
        headers,
      })
      const body = matrix.json() as { entityStatus: string }
      expect(body.entityStatus).toBe('BLOCKED') // the other required web controls are still MISSING
    })
  })
})
