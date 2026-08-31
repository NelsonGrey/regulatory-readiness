import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderRoute } from '../test/harness.js'

const note = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'ntf_1',
  eventTopic: 'request.submitted',
  title: 'A supplier submitted a response',
  body: 'Evidence request req_1 has a new submission.',
  entityId: 'ent_1',
  targetType: 'evidence_request',
  targetId: 'req_1',
  readAt: null,
  createdAt: '2026-08-31T10:00:00.000Z',
  ...over,
})

describe('NotificationsPage', () => {
  it('lists notifications and marks one read', async () => {
    const user = userEvent.setup()
    let read = false
    const { calls } = mockApi([
      { path: '/api/v1/notifications/unread-count', method: 'GET', body: { count: 1 } },
      {
        path: '/api/v1/notifications',
        method: 'GET',
        get body() {
          return {
            notifications: [note({ readAt: read ? '2026-08-31T10:05:00.000Z' : null })],
            unreadCount: read ? 0 : 1,
          }
        },
      },
      {
        path: '/api/v1/notifications/ntf_1/read',
        method: 'POST',
        get body() {
          read = true
          return { ok: true }
        },
      },
    ])

    renderRoute('/w/notifications')

    expect(await screen.findByText('A supplier submitted a response')).toBeInTheDocument()
    // deep link to the request
    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute(
      'href',
      '/w/entities/ent_1/requests/req_1',
    )

    await user.click(screen.getByRole('button', { name: /^mark read$/i }))

    await waitFor(() => {
      expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/ntf_1/read'))).toBe(true)
    })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^mark read$/i })).not.toBeInTheDocument()
    })
  })

  it('marks all read', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi([
      { path: '/api/v1/notifications/unread-count', method: 'GET', body: { count: 2 } },
      {
        path: '/api/v1/notifications',
        method: 'GET',
        body: {
          notifications: [note(), note({ id: 'ntf_2', createdAt: '2026-08-31T09:00:00.000Z' })],
          unreadCount: 2,
        },
      },
      { path: '/api/v1/notifications/read-all', method: 'POST', body: { marked: 2 } },
    ])

    renderRoute('/w/notifications')

    await user.click(await screen.findByRole('button', { name: /mark all read \(2\)/i }))

    await waitFor(() => {
      expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/read-all'))).toBe(true)
    })
  })

  it('shows an empty state', async () => {
    mockApi([
      { path: '/api/v1/notifications/unread-count', method: 'GET', body: { count: 0 } },
      { path: '/api/v1/notifications', method: 'GET', body: { notifications: [], unreadCount: 0 } },
    ])
    renderRoute('/w/notifications')
    expect(await screen.findByText(/nothing here yet/i)).toBeInTheDocument()
  })
})
