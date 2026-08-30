import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { authFromRequest } from '../auth.js'
import type { AuditRecord } from '../db/uow.js'
import type { AuditService } from '../services/audit.js'

interface AuditRoutesOptions extends FastifyPluginOptions {
  audit: AuditService
}

interface AuditQueryString {
  targetType?: string
  targetId?: string
  action?: string
  since?: string
  before?: string
  limit?: string
}

/** Only safe, non-sensitive fields leave the API (engine TRD §20, AC-018). */
function toWire(e: AuditRecord) {
  return {
    id: e.id,
    seq: e.seq,
    actorType: e.actorType,
    actorId: e.actorId,
    action: e.action,
    targetType: e.targetType,
    targetId: e.targetId,
    occurredAt: e.occurredAt,
    correlationId: e.correlationId ?? null,
    reason: e.reason ?? null,
    metadata: e.metadata,
  }
}

/**
 * GET /api/v1/audit-events — AUD-001. Newest first; filter by target/action/since,
 * paginate with `before` (an opaque `seq` cursor).
 */
export async function registerAuditRoutes(
  app: FastifyInstance,
  opts: AuditRoutesOptions,
): Promise<void> {
  app.get('/audit-events', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) {
      return reply
        .code(401)
        .send({ error: { code: 'NO_TENANT', message: 'x-tenant-id header is required' } })
    }

    const q = req.query as AuditQueryString
    const limit = q.limit !== undefined ? Number.parseInt(q.limit, 10) : undefined
    if (limit !== undefined && Number.isNaN(limit)) {
      return reply
        .code(422)
        .send({ error: { code: 'INVALID_LIMIT', message: 'limit must be an integer' } })
    }

    const page = await opts.audit.list(auth, {
      targetType: q.targetType,
      targetId: q.targetId,
      action: q.action,
      since: q.since,
      before: q.before,
      limit,
    })

    return { events: page.events.map(toWire), nextBefore: page.nextBefore }
  })
}
