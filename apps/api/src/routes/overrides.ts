import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { RecordOverrideRequest } from '@rre/contracts'
import { authFromRequest } from '../auth.js'
import type { OverrideService } from '../services/overrides.js'

interface OverrideRoutesOptions extends FastifyPluginOptions {
  overrides: OverrideService
}

const NO_TENANT = { error: { code: 'NO_TENANT', message: 'x-tenant-id header is required' } }

/** Applicability overrides (engine TRD §13.3). */
export async function registerOverrideRoutes(
  app: FastifyInstance,
  opts: OverrideRoutesOptions,
): Promise<void> {
  app.post('/entities/:id/controls/:controlKey/applicability-override', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const parsed = RecordOverrideRequest.safeParse(req.body)
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
    const result = await opts.overrides.record(auth, id, controlKey, parsed.data)
    if (!result.ok) {
      const code = result.code === 'ENTITY_NOT_FOUND' ? 404 : 422
      return reply.code(code).send({ error: { code: result.code, message: result.message } })
    }
    return reply.code(201).send({ override: result.override })
  })

  app.get('/entities/:id/applicability-overrides', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { id } = req.params as { id: string }
    return { overrides: await opts.overrides.list(auth, id) }
  })

  app.post('/applicability-overrides/:overrideId/revoke', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { overrideId } = req.params as { overrideId: string }
    const result = await opts.overrides.revoke(auth, overrideId)
    if (!result.ok) {
      const code = result.code === 'NOT_FOUND' ? 404 : 409
      return reply.code(code).send({ error: { code: result.code, message: result.message } })
    }
    return { ok: true }
  })
}
