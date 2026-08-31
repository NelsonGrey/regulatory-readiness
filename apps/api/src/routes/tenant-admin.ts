import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { ExecuteDeletionRequest, RequestDeletionRequest } from '@rre/contracts'
import { authFromRequest } from '../auth.js'
import type { TenantAdminService } from '../services/tenant-admin.js'

interface TenantAdminRoutesOptions extends FastifyPluginOptions {
  tenantAdmin: TenantAdminService
}

const NO_TENANT = { error: { code: 'NO_TENANT', message: 'x-tenant-id header is required' } }

/** Customer data export + tenant deletion (engine TRD §21). */
export async function registerTenantAdminRoutes(
  app: FastifyInstance,
  opts: TenantAdminRoutesOptions,
): Promise<void> {
  app.get('/export/tenant', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const bundle = await opts.tenantAdmin.exportBundle(auth)
    return reply
      .header('content-type', 'application/json')
      .header(
        'content-disposition',
        `attachment; filename="${auth.tenantId}-export-${bundle.generatedAt.slice(0, 10)}.json"`,
      )
      .send(JSON.stringify(bundle, null, 2))
  })

  app.post('/deletion-requests', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const parsed = RequestDeletionRequest.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'INVALID_BODY',
          message: 'invalid request body',
          details: parsed.error.issues,
        },
      })
    }
    const result = await opts.tenantAdmin.requestDeletion(auth, parsed.data)
    if (!result.ok) {
      return reply.code(422).send({ error: { code: result.code, message: result.message } })
    }
    return reply
      .code(201)
      .send({ deletionRequestId: result.deletionRequestId, preview: result.preview })
  })

  app.get('/deletion-requests', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    return { deletionRequests: await opts.tenantAdmin.listDeletionRequests(auth) }
  })

  app.post('/deletion-requests/:id/execute', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const parsed = ExecuteDeletionRequest.safeParse(req.body)
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
    const result = await opts.tenantAdmin.executeDeletion(auth, id, parsed.data)
    if (!result.ok) {
      const code = result.code === 'NOT_FOUND' ? 404 : result.code === 'NOT_PENDING' ? 409 : 422
      return reply.code(code).send({ error: { code: result.code, message: result.message } })
    }
    return { ok: true, purged: result.purged, objectsRemoved: result.objectsRemoved }
  })
}
