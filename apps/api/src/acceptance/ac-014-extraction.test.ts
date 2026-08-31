/**
 * User-acceptance scenario for AC-014 — extraction proposals.
 * Extraction turns an uploaded document into proposals; each keeps its source
 * quote; no proposal becomes a value without a human accepting it, which creates
 * a claim (still in review) plus the extracted evidence link.
 */
import { describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app.js'
import { createInMemoryStores, inMemoryUnitOfWork } from '../db/uow.js'
import { bankEntityRequest, type InjectResponse } from './helpers.js'

const CONTROL = 'EAA-EN549-9-2-1-1'
const headers = { 'x-tenant-id': 't-demo', 'x-actor': 'manager@acme' }
const DOC_TEXT = 'Audit notes\nKeyboard: fully operable by keyboard\n'

describe('AC-014 — extraction proposals', () => {
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

  async function seed(app: FastifyInstance): Promise<{ entityId: string; documentId: string }> {
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

    const started = await app.inject({
      method: 'POST',
      url: '/api/v1/documents',
      headers,
      payload: {
        filename: 'notes.txt',
        mediaType: 'text/plain',
        sizeBytes: DOC_TEXT.length,
        entityId,
      },
    })
    const { documentId, uploadUrl } = json(started) as { documentId: string; uploadUrl: string }
    await app.inject({
      method: 'PUT',
      url: uploadUrl,
      headers: { ...headers, 'content-type': 'application/octet-stream' },
      payload: Buffer.from(DOC_TEXT),
    })
    await app.inject({ method: 'POST', url: `/api/v1/documents/${documentId}/finalize`, headers })
    return { entityId, documentId }
  }

  it('run → PENDING proposals → accept one → SELF_ATTESTED-free EVIDENCED after approval', async () => {
    await withApp(async (app) => {
      const { entityId, documentId } = await seed(app)

      const run = await app.inject({
        method: 'POST',
        url: `/api/v1/entities/${entityId}/documents/${documentId}/extractions`,
        headers,
      })
      expect(run.statusCode).toBe(201)
      const { runId, proposalCount } = json(run) as { runId: string; proposalCount: number }
      expect(proposalCount).toBeGreaterThan(0)

      const detail = await app.inject({
        method: 'GET',
        url: `/api/v1/extractions/${runId}`,
        headers,
      })
      const proposals = (
        detail.json() as {
          proposals: Array<{ id: string; controlKey: string; quote: string; status: string }>
        }
      ).proposals
      const target = proposals.find((p) => p.controlKey === CONTROL)!
      expect(target.status).toBe('PENDING')
      expect(target.quote).toContain('Keyboard')

      const accepted = await app.inject({
        method: 'POST',
        url: `/api/v1/extraction-proposals/${target.id}/accept`,
        headers,
      })
      expect(accepted.statusCode).toBe(201)
      const claimId = (accepted.json() as { claimId: string }).claimId

      await app.inject({
        method: 'POST',
        url: `/api/v1/claims/${claimId}/decisions`,
        headers,
        payload: { decision: 'APPROVED' },
      })

      const matrix = await app.inject({
        method: 'GET',
        url: `/api/v1/entities/${entityId}/matrix`,
        headers,
      })
      const row = (
        matrix.json() as {
          rows: Array<{ control: string; readiness: string; evidenceCount: number }>
        }
      ).rows.find((r) => r.control === CONTROL)
      expect(row?.readiness).toBe('EVIDENCED')
      expect(row?.evidenceCount).toBe(1)
    })
  })

  it('rejecting a proposal needs a reason and does not create a claim', async () => {
    await withApp(async (app) => {
      const { entityId, documentId } = await seed(app)
      const runId = (
        json(
          await app.inject({
            method: 'POST',
            url: `/api/v1/entities/${entityId}/documents/${documentId}/extractions`,
            headers,
          }),
        ) as { runId: string }
      ).runId
      const proposalId = (
        (
          await app.inject({ method: 'GET', url: `/api/v1/extractions/${runId}`, headers })
        ).json() as {
          proposals: Array<{ id: string }>
        }
      ).proposals[0]!.id

      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/extraction-proposals/${proposalId}/reject`,
            headers,
            payload: {},
          })
        ).statusCode,
      ).toBe(422)
      const rejected = await app.inject({
        method: 'POST',
        url: `/api/v1/extraction-proposals/${proposalId}/reject`,
        headers,
        payload: { reason: 'value is wrong' },
      })
      expect(rejected.statusCode).toBe(200)

      // accepting a rejected proposal now conflicts
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/extraction-proposals/${proposalId}/accept`,
            headers,
          })
        ).statusCode,
      ).toBe(409)
    })
  })
})
