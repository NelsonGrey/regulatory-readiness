import type { PoolClient } from 'pg'
import type {
  NotificationQuery,
  NotificationRecord,
  NotificationRepository,
} from '../services/notifications.js'

interface NotificationRow {
  id: string
  tenant_id: string
  event_topic: string
  title: string
  body: string
  entity_id: string | null
  target_type: string | null
  target_id: string | null
  read_at: Date | null
  created_at: Date
}

function toRecord(r: NotificationRow): NotificationRecord {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    eventTopic: r.event_topic,
    title: r.title,
    body: r.body,
    entityId: r.entity_id,
    targetType: r.target_type,
    targetId: r.target_id,
    readAt: r.read_at ? r.read_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
  }
}

export class PgNotificationRepository implements NotificationRepository {
  constructor(
    private readonly db: PoolClient,
    private readonly tenantId: string,
  ) {}

  async list(query: NotificationQuery): Promise<NotificationRecord[]> {
    const res = await this.db.query<NotificationRow>(
      `SELECT * FROM notification
        WHERE tenant_id = $1
          AND ($2::boolean IS FALSE OR read_at IS NULL)
        ORDER BY seq DESC
        LIMIT $3`,
      [this.tenantId, query.unreadOnly, query.limit],
    )
    return res.rows.map(toRecord)
  }

  async countUnread(): Promise<number> {
    const res = await this.db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM notification WHERE tenant_id = $1 AND read_at IS NULL`,
      [this.tenantId],
    )
    return res.rows[0]?.n ?? 0
  }

  async markRead(id: string, at: string): Promise<boolean> {
    const res = await this.db.query(
      `UPDATE notification SET read_at = $1
        WHERE id = $2 AND tenant_id = $3 AND read_at IS NULL`,
      [at, id, this.tenantId],
    )
    return (res.rowCount ?? 0) > 0
  }

  async markAllRead(at: string): Promise<number> {
    const res = await this.db.query(
      `UPDATE notification SET read_at = $1 WHERE tenant_id = $2 AND read_at IS NULL`,
      [at, this.tenantId],
    )
    return res.rowCount ?? 0
  }
}
