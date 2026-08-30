import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { CreateRequestRequest } from '@rre/contracts'
import { authFromRequest } from '../auth.js'
import type { RequestService } from '../services/requests.js'

interface RequestRoutesOptions extends FastifyPluginOptions {
  requests: RequestService
}

const NO_TENANT = { error: { code: 'NO_TENANT', message: 'x-tenant-id header is required' } }

/** Operator side of the request loop (engine detailed design 02: REQ-001..003). */
export async function registerRequestRoutes(
  app: FastifyInstance,
  opts: RequestRoutesOptions,
): Promise<void> {
  app.post('/entities/:id/requests', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const parsed = CreateRequestRequest.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'INVALID_BODY',
          message: 'invalid request body',
          details: parsed.error.issues,
        },
      })
    }
    const { id } = req.params as { id: string }
    const result = await opts.requests.createRequest(auth, id, parsed.data)
    if (!result.ok) {
      const code = result.code === 'ENTITY_NOT_FOUND' ? 404 : 422
      return reply.code(code).send({ error: { code: result.code, message: result.message } })
    }
    // The plaintext token is returned exactly once.
    return reply.code(201).send({
      request: result.request,
      items: result.items,
      token: result.token,
      tokenPrefix: result.grant.tokenPrefix,
      expiresAt: result.grant.expiresAt,
      contributorPath: `/contributor/v1/requests/${result.token}`,
    })
  })

  app.get('/entities/:id/requests', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { id } = req.params as { id: string }
    return { requests: await opts.requests.listRequests(auth, id) }
  })

  app.get('/requests/:requestId', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { requestId } = req.params as { requestId: string }
    const detail = await opts.requests.getDetail(auth, requestId)
    if (!detail)
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'request not found' } })
    return detail
  })

  app.post('/requests/:requestId/send', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { requestId } = req.params as { requestId: string }
    const ok = await opts.requests.send(auth, requestId)
    if (!ok)
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'request not found' } })
    return { ok: true }
  })

  app.post('/requests/:requestId/revoke', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { requestId } = req.params as { requestId: string }
    const ok = await opts.requests.revoke(auth, requestId)
    if (!ok)
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'request not found' } })
    return { ok: true }
  })

  app.post('/submissions/:submissionId/items/:itemId/accept', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { submissionId, itemId } = req.params as { submissionId: string; itemId: string }
    const result = await opts.requests.acceptResponseItem(auth, submissionId, itemId)
    if (!result.ok) {
      const code = result.code === 'NOT_FOUND' ? 404 : 409
      return reply.code(code).send({ error: { code: result.code, message: result.message } })
    }
    return reply.code(201).send({ claimId: result.claimId })
  })
}
