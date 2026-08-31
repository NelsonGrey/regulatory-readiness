import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { authFromRequest } from '../auth.js'
import type { NotificationService } from '../services/notifications.js'

interface NotificationRoutesOptions extends FastifyPluginOptions {
  notifications: NotificationService
}

const NO_TENANT = { error: { code: 'NO_TENANT', message: 'x-tenant-id header is required' } }

export async function registerNotificationRoutes(
  app: FastifyInstance,
  opts: NotificationRoutesOptions,
): Promise<void> {
  app.get('/notifications', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const q = req.query as { unread?: string; limit?: string }
    return opts.notifications.list(auth, {
      unreadOnly: q.unread === '1' || q.unread === 'true',
      limit: q.limit ? Number(q.limit) : undefined,
    })
  })

  app.get('/notifications/unread-count', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    return { count: await opts.notifications.unreadCount(auth) }
  })

  app.post('/notifications/:id/read', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { id } = req.params as { id: string }
    const ok = await opts.notifications.markRead(auth, id)
    if (!ok) {
      return reply
        .code(404)
        .send({ error: { code: 'NOT_FOUND', message: 'no unread notification with that id' } })
    }
    return { ok: true }
  })

  app.post('/notifications/read-all', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    return { marked: await opts.notifications.markAllRead(auth) }
  })
}
