import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { AssertClaimRequest, LinkEvidenceRequest, ReviewDecisionRequest } from '@rre/contracts'
import { authFromRequest } from '../auth.js'
import type { ClaimService } from '../services/claims.js'

interface ClaimRoutesOptions extends FastifyPluginOptions {
  claims: ClaimService
}

const NO_TENANT = { error: { code: 'NO_TENANT', message: 'x-tenant-id header is required' } }

/**
 * Claim assertion and review (engine detailed design 02: MAT-002, REV-001).
 * - POST /entities/:id/controls/:controlKey/claims
 * - POST /claims/:claimId/decisions
 * - GET  /entities/:id/review-queue
 */
export async function registerClaimRoutes(
  app: FastifyInstance,
  opts: ClaimRoutesOptions,
): Promise<void> {
  app.post('/entities/:id/controls/:controlKey/claims', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)

    const parsed = AssertClaimRequest.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'INVALID_BODY',
          message: 'invalid request body',
          details: parsed.error.issues,
        },
      })
    }

    const { id, controlKey } = req.params as { id: string; controlKey: string }
    const result = await opts.claims.assert(auth, id, controlKey, parsed.data)
    if (!result.ok) {
      const status = result.code === 'CONTROL_NOT_APPLICABLE' ? 409 : 404
      return reply.code(status).send({ error: { code: result.code, message: result.message } })
    }
    return reply.code(201).send({ claim: result.claim })
  })

  app.post('/claims/:claimId/decisions', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)

    const parsed = ReviewDecisionRequest.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'INVALID_BODY',
          message: 'invalid request body',
          details: parsed.error.issues,
        },
      })
    }

    const { claimId } = req.params as { claimId: string }
    const result = await opts.claims.decide(auth, claimId, parsed.data)
    if (!result.ok) {
      const status =
        result.code === 'CLAIM_NOT_FOUND' ? 404 : result.code === 'NOT_PENDING' ? 409 : 422
      return reply.code(status).send({ error: { code: result.code, message: result.message } })
    }
    return { claim: result.claim }
  })

  app.post('/claims/:claimId/evidence', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const parsed = LinkEvidenceRequest.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'INVALID_BODY',
          message: 'invalid request body',
          details: parsed.error.issues,
        },
      })
    }
    const { claimId } = req.params as { claimId: string }
    const result = await opts.claims.linkEvidence(auth, claimId, parsed.data)
    if (!result.ok) {
      const status = result.code === 'DOCUMENT_NOT_AVAILABLE' ? 409 : 404
      return reply.code(status).send({ error: { code: result.code, message: result.message } })
    }
    return reply
      .code(201)
      .send({ evidenceLocationId: result.evidenceLocationId, linkId: result.linkId })
  })

  app.get('/claims/:claimId/evidence', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { claimId } = req.params as { claimId: string }
    return { evidence: await opts.claims.listEvidence(auth, claimId) }
  })

  app.get('/entities/:id/review-queue', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)

    const { id } = req.params as { id: string }
    const queue = await opts.claims.reviewQueue(auth, id)
    if (!queue)
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'entity not found' } })
    return queue
  })
}
