import { beforeEach, describe, expect, it } from 'vitest'
import { createInMemoryStores, inMemoryUnitOfWork, type InMemoryStores } from '../db/uow.js'
import { NotificationService } from './notifications.js'
import type { NotificationRecord } from './notifications.js'
import type { AuthContext } from '../auth.js'

const auth: AuthContext = { tenantId: 't-demo', actor: 'manager@acme' }
const other: AuthContext = { tenantId: 't-other', actor: 'x' }

function seed(stores: InMemoryStores): void {
  const rows: NotificationRecord[] = [
    row('ntf_1', 't-demo', '2026-08-31T09:00:00.000Z'),
    row('ntf_2', 't-demo', '2026-08-31T10:00:00.000Z'),
    row('ntf_3', 't-demo', '2026-08-31T11:00:00.000Z', '2026-08-31T11:05:00.000Z'),
    row('ntf_4', 't-other', '2026-08-31T09:30:00.000Z'),
  ]
  stores.notifications.push(...rows)
}

const row = (
  id: string,
  tenantId: string,
  createdAt: string,
  readAt: string | null = null,
): NotificationRecord => ({
  id,
  tenantId,
  eventTopic: 'request.submitted',
  title: `Notification ${id}`,
  body: 'body',
  entityId: 'ent_1',
  targetType: 'evidence_request',
  targetId: 'req_1',
  readAt,
  createdAt,
})

describe('NotificationService', () => {
  let svc: NotificationService
  let stores: InMemoryStores

  beforeEach(() => {
    stores = createInMemoryStores()
    seed(stores)
    svc = new NotificationService(inMemoryUnitOfWork(stores))
  })

  it('lists the tenant’s notifications newest-first with an unread count', async () => {
    const { notifications, unreadCount } = await svc.list(auth)
    expect(notifications.map((n) => n.id)).toEqual(['ntf_3', 'ntf_2', 'ntf_1'])
    expect(unreadCount).toBe(2)
    // never another tenant's
    expect((await svc.list(other)).notifications.map((n) => n.id)).toEqual(['ntf_4'])
  })

  it('filters to unread only', async () => {
    const { notifications } = await svc.list(auth, { unreadOnly: true })
    expect(notifications.map((n) => n.id)).toEqual(['ntf_2', 'ntf_1'])
  })

  it('marks one read (idempotent) and updates the count', async () => {
    expect(await svc.markRead(auth, 'ntf_1')).toBe(true)
    expect(await svc.markRead(auth, 'ntf_1')).toBe(false) // already read
    expect(await svc.markRead(auth, 'ntf_4')).toBe(false) // other tenant
    expect(await svc.unreadCount(auth)).toBe(1)
  })

  it('marks all read and returns how many changed', async () => {
    expect(await svc.markAllRead(auth)).toBe(2)
    expect(await svc.unreadCount(auth)).toBe(0)
    // the other tenant is untouched
    expect(await svc.unreadCount(other)).toBe(1)
  })
})
