import { randomUUID } from 'node:crypto'
import { withTenant } from '@rre/db'
import type { Pool } from './db.js'
import type { NotificationDraft, NotificationWriter } from './notifications.js'

/**
 * Writes notification rows as `rre_app`, under the event's tenant (the consumer
 * already knows it), so RLS is satisfied without BYPASSRLS.
 */
export function pgNotificationWriter(pool: Pool): NotificationWriter {
  return {
    async write(draft: NotificationDraft, now: Date): Promise<void> {
      await withTenant(pool, draft.tenantId, (c) =>
        c.query(
          `INSERT INTO notification
             (id, tenant_id, event_topic, title, body, entity_id, target_type, target_id, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            `ntf_${randomUUID()}`,
            draft.tenantId,
            draft.eventTopic,
            draft.title,
            draft.body,
            draft.entityId,
            draft.targetType,
            draft.targetId,
            now.toISOString(),
          ],
        ),
      )
    },
  }
}
