import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { RejectProposalRequest } from '@rre/contracts'
import { authFromRequest } from '../auth.js'
import type { ExtractionService } from '../services/extraction.js'

interface ExtractionRoutesOptions extends FastifyPluginOptions {
  extraction: ExtractionService
}

const NO_TENANT = { error: { code: 'NO_TENANT', message: 'x-tenant-id header is required' } }

/** AI/OCR extraction — runs, proposals, and the human accept/reject gate (engine TRD §11). */
export async function registerExtractionRoutes(
  app: FastifyInstance,
  opts: ExtractionRoutesOptions,
): Promise<void> {
  app.post('/entities/:id/documents/:documentId/extractions', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { id, documentId } = req.params as { id: string; documentId: string }
    const result = await opts.extraction.run(auth, id, documentId)
    if (!result.ok) {
      const code = result.code === 'DOCUMENT_NOT_FOUND' ? 404 : 409
      return reply.code(code).send({ error: { code: result.code, message: result.message } })
    }
    return reply.code(201).send({ runId: result.runId, proposalCount: result.proposalCount })
  })

  app.get('/entities/:id/documents/:documentId/extractions', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { documentId } = req.params as { documentId: string }
    return { runs: await opts.extraction.list(auth, documentId) }
  })

  app.get('/extractions/:runId', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { runId } = req.params as { runId: string }
    const detail = await opts.extraction.get(auth, runId)
    if (!detail) {
      return reply
        .code(404)
        .send({ error: { code: 'NOT_FOUND', message: 'extraction run not found' } })
    }
    return detail
  })

  app.post('/extraction-proposals/:proposalId/accept', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { proposalId } = req.params as { proposalId: string }
    const result = await opts.extraction.acceptProposal(auth, proposalId)
    if (!result.ok) {
      const code = result.code === 'PROPOSAL_NOT_FOUND' ? 404 : 409
      return reply.code(code).send({ error: { code: result.code, message: result.message } })
    }
    return reply.code(201).send({ claimId: result.claimId })
  })

  app.post('/extraction-proposals/:proposalId/reject', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const parsed = RejectProposalRequest.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'INVALID_BODY',
          message: 'a reason is required',
          details: parsed.error.issues,
        },
      })
    }
    const { proposalId } = req.params as { proposalId: string }
    const result = await opts.extraction.rejectProposal(auth, proposalId, parsed.data.reason)
    if (!result.ok) {
      const code =
        result.code === 'PROPOSAL_NOT_FOUND' ? 404 : result.code === 'REASON_REQUIRED' ? 422 : 409
      return reply.code(code).send({ error: { code: result.code, message: result.message } })
    }
    return { ok: true }
  })
}
