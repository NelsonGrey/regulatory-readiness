import type { AuthContext } from '../auth.js'
import type { UnitOfWork } from '../db/uow.js'

export interface NotificationRecord {
  id: string
  tenantId: string
  eventTopic: string
  title: string
  body: string
  entityId: string | null
  targetType: string | null
  targetId: string | null
  readAt: string | null
  createdAt: string
}

export interface NotificationQuery {
  unreadOnly: boolean
  limit: number
}

/** Read + mark-as-read only; notification rows are written by the worker. */
export interface NotificationRepository {
  list(query: NotificationQuery): Promise<NotificationRecord[]>
  countUnread(): Promise<number>
  markRead(id: string, at: string): Promise<boolean>
  markAllRead(at: string): Promise<number>
}

export class NotificationService {
  constructor(private readonly uow: UnitOfWork) {}

  async list(
    auth: AuthContext,
    opts: { unreadOnly?: boolean; limit?: number } = {},
  ): Promise<{ notifications: NotificationRecord[]; unreadCount: number }> {
    return this.uow(auth.tenantId, async (u) => ({
      notifications: await u.notifications.list({
        unreadOnly: opts.unreadOnly ?? false,
        limit: Math.min(Math.max(opts.limit ?? 50, 1), 200),
      }),
      unreadCount: await u.notifications.countUnread(),
    }))
  }

  async unreadCount(auth: AuthContext): Promise<number> {
    return this.uow(auth.tenantId, (u) => u.notifications.countUnread())
  }

  async markRead(auth: AuthContext, id: string, now: Date = new Date()): Promise<boolean> {
    return this.uow(auth.tenantId, (u) => u.notifications.markRead(id, now.toISOString()))
  }

  async markAllRead(auth: AuthContext, now: Date = new Date()): Promise<number> {
    return this.uow(auth.tenantId, (u) => u.notifications.markAllRead(now.toISOString()))
  }
}
