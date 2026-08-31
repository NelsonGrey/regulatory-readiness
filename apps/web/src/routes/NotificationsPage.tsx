import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import type { NotificationList, NotificationRecord } from '../api/types.js'

function targetLink(n: NotificationRecord): string | null {
  if (n.targetType === 'evidence_request' && n.entityId && n.targetId) {
    return `/w/entities/${n.entityId}/requests/${n.targetId}`
  }
  if (n.targetType === 'readiness_snapshot' && n.entityId) {
    return `/w/entities/${n.entityId}/snapshots`
  }
  return null
}

export function NotificationsPage(): ReactElement {
  const [list, setList] = useState<NotificationList | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState('')

  const load = useCallback(() => {
    let live = true
    setStatus('loading')
    api
      .get<NotificationList>('/notifications?limit=100')
      .then((l) => {
        if (!live) return
        setList(l)
        setStatus('ok')
      })
      .catch(() => live && setStatus('error'))
    return () => {
      live = false
    }
  }, [])

  useEffect(() => load(), [load, version])

  async function markRead(id: string): Promise<void> {
    setBusy(id)
    try {
      await api.post(`/notifications/${id}/read`, {})
      setVersion((v) => v + 1)
    } finally {
      setBusy('')
    }
  }

  async function markAll(): Promise<void> {
    setBusy('all')
    try {
      await api.post('/notifications/read-all', {})
      setVersion((v) => v + 1)
    } finally {
      setBusy('')
    }
  }

  if (status === 'loading') return <p>Loading notifications…</p>
  if (status === 'error' || !list) return <p className="rre-error">Could not load notifications.</p>

  return (
    <section>
      <h1>Notifications</h1>
      <p className="rre-note">
        Events that happened without you watching — a supplier submitted, a request expired, a
        snapshot was frozen.
      </p>

      {list.notifications.length === 0 ? (
        <p>Nothing here yet.</p>
      ) : (
        <>
          <div className="rre-actions">
            <button
              type="button"
              className="rre-secondary"
              disabled={busy === 'all' || list.unreadCount === 0}
              onClick={markAll}
            >
              {list.unreadCount === 0 ? 'All read' : `Mark all read (${list.unreadCount})`}
            </button>
          </div>

          <ul className="rre-queue">
            {list.notifications.map((n) => {
              const to = targetLink(n)
              return (
                <li
                  key={n.id}
                  className="rre-queue-item"
                  data-unread={n.readAt === null ? 'true' : undefined}
                >
                  <div className="rre-queue-head">
                    {new Date(n.createdAt).toLocaleString()} · <code>{n.eventTopic}</code>
                  </div>
                  <strong>{n.title}</strong>
                  <div>{n.body}</div>
                  <div className="rre-actions">
                    {to ? (
                      <Link className="rre-secondary" to={to}>
                        Open
                      </Link>
                    ) : null}
                    {n.readAt === null ? (
                      <button
                        type="button"
                        className="rre-secondary"
                        disabled={busy === n.id}
                        onClick={() => markRead(n.id)}
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
