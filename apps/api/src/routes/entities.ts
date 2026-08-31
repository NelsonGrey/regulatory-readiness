import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { CreateEntityRequest, ReEvaluateRequest } from '@rre/contracts'
import { authFromRequest } from '../auth.js'
import type { EntityService } from '../services/entities.js'

interface EntityRoutesOptions extends FastifyPluginOptions {
  entities: EntityService
}

const NO_TENANT = {
  error: { code: 'NO_TENANT', message: 'x-tenant-id header is required' },
}

/**
 * ENT-001 create + the data-point matrix (engine detailed design 02, AC-003/AC-004).
 */
export async function registerEntityRoutes(
  app: FastifyInstance,
  opts: EntityRoutesOptions,
): Promise<void> {
  app.post('/entities', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)

    const parsed = CreateEntityRequest.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'INVALID_BODY',
          message: 'invalid request body',
          details: parsed.error.issues,
        },
      })
    }

    const result = await opts.entities.create(auth, parsed.data)
    if (!result.ok) {
      const status =
        result.code === 'PACK_NOT_FOUND'
          ? 404
          : result.code === 'INVALID_FACTS' || result.code === 'KIND_MISMATCH'
            ? 422
            : result.code === 'QUOTA_EXCEEDED'
              ? 402
              : 409
      return reply.code(status).send({
        error: {
          code: result.code,
          message: result.message,
          issues: 'issues' in result ? result.issues : undefined,
        },
      })
    }

    return reply.code(201).send({
      entity: result.entity,
      evaluation: {
        id: result.evaluation.id,
        snapshotKey: result.evaluation.snapshotKey,
        hash: result.evaluation.hash,
        version: result.evaluation.version,
      },
    })
  })

  app.post('/entities/:id/re-evaluate', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const parsed = ReEvaluateRequest.safeParse(req.body ?? {})
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
    const result = await opts.entities.reEvaluate(auth, id, parsed.data)
    if (!result.ok) {
      const status =
        result.code === 'ENTITY_NOT_FOUND' ? 404 : result.code === 'INVALID_FACTS' ? 422 : 409
      return reply.code(status).send({
        error: {
          code: result.code,
          message: result.message,
          issues: 'issues' in result ? result.issues : undefined,
        },
      })
    }
    return reply.code(201).send(result)
  })

  app.get('/packs/:packKey/impact', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { packKey } = req.params as { packKey: string }
    const result = await opts.entities.snapshotImpact(auth, packKey)
    if (!result.ok) {
      const status = result.code === 'PACK_NOT_FOUND' ? 404 : 409
      return reply.code(status).send({ error: { code: result.code, message: result.message } })
    }
    return result.report
  })

  app.get('/entities/:id/matrix', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)

    const { id } = req.params as { id: string }
    const matrix = await opts.entities.matrix(auth, id)
    if (!matrix) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'entity not found' } })
    }
    return matrix
  })
}
