import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { ContributorSubmitRequest } from '@rre/contracts'
import type { ContributorService } from '../services/requests.js'

interface ContributorRoutesOptions extends FastifyPluginOptions {
  contributor: ContributorService
}

const PORTAL_HEADERS = {
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
}

/**
 * No-account contributor portal (engine detailed design 03: SUP-001..006).
 * The token is the principal — no tenant header. Invalid / expired / revoked
 * tokens all return the same generic response.
 */
export async function registerContributorRoutes(
  app: FastifyInstance,
  opts: ContributorRoutesOptions,
): Promise<void> {
  app.addHook('onSend', async (_req, reply) => {
    for (const [k, v] of Object.entries(PORTAL_HEADERS)) reply.header(k, v)
  })

  app.get('/requests/:token', async (req, reply) => {
    const { token } = req.params as { token: string }
    const result = await opts.contributor.view(token)
    if (!result.ok) {
      return reply.code(404).send({ error: { code: result.code, message: result.message } })
    }
    return result.data
  })

  app.post('/requests/:token/submit', async (req, reply) => {
    const { token } = req.params as { token: string }
    const parsed = ContributorSubmitRequest.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'INVALID_BODY',
          message: 'invalid request body',
          details: parsed.error.issues,
        },
      })
    }
    const result = await opts.contributor.submit(token, parsed.data)
    if (!result.ok) {
      const code = result.code === 'INVALID_LINK' ? 404 : result.code === 'INCOMPLETE' ? 422 : 422
      return reply.code(code).send({ error: { code: result.code, message: result.message } })
    }
    return reply
      .code(201)
      .send({ ...result.data, note: 'Received for review; not yet accepted or approved.' })
  })

  app.get('/requests/:token/receipt', async (req, reply) => {
    const { token } = req.params as { token: string }
    const result = await opts.contributor.receipt(token)
    if (!result.ok) {
      return reply.code(404).send({ error: { code: result.code, message: result.message } })
    }
    return result.data
  })
}
