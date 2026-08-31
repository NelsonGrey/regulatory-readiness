import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderRoute } from '../test/harness.js'

const workspaces = {
  path: '/api/v1/workspaces',
  method: 'GET',
  body: {
    workspaces: [{ id: 'demo-tenant', name: 'Demo', slug: 'demo', plan: 'trial', role: 'owner' }],
  },
}
const unread = { path: '/api/v1/notifications/unread-count', method: 'GET', body: { count: 0 } }

const roster = (over: Partial<Record<string, unknown>> = {}) => ({
  path: '/api/v1/members',
  method: 'GET',
  body: {
    members: [
      {
        userId: 'usr_me',
        email: 'operator@local',
        name: 'Operator',
        role: 'owner',
        createdAt: '2026-08-01T00:00:00.000Z',
      },
      {
        userId: 'usr_pat',
        email: 'pat@acme.test',
        name: null,
        role: 'member',
        createdAt: '2026-08-02T00:00:00.000Z',
      },
    ],
    pendingInvites: [],
    ...over,
  },
})

describe('MembersPage', () => {
  it('shows the roster and lets an owner invite a teammate', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi([
      workspaces,
      unread,
      roster(),
      {
        path: '/api/v1/members/invites',
        method: 'POST',
        status: 201,
        body: {
          inviteId: 'inv_1',
          token: 'tok_abcdefabcdefabcdefabcdefabcdef12',
          acceptPath: '/join/tok_abcdefabcdefabcdefabcdefabcdef12',
          expiresAt: '2026-09-14T00:00:00.000Z',
        },
      },
    ])

    renderRoute('/w/settings/members')

    expect(await screen.findByText('pat@acme.test')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/^email$/i), 'newbie@acme.test')
    await user.selectOptions(screen.getByLabelText(/^role$/i), 'admin')
    await user.click(screen.getByRole('button', { name: /send invite/i }))

    const panel = await screen.findByTestId('invite-link')
    expect(panel).toHaveTextContent('/join/tok_abcdefabcdefabcdefabcdefabcdef12')
    const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/members/invites'))
    expect(post?.body).toEqual({ email: 'newbie@acme.test', role: 'admin' })
  })

  it('changes a member’s role', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi([
      workspaces,
      unread,
      roster(),
      { path: '/api/v1/members/usr_pat', method: 'PATCH', body: { ok: true } },
    ])

    renderRoute('/w/settings/members')

    const roleSelect = await screen.findByLabelText(/role for pat@acme\.test/i)
    await user.selectOptions(roleSelect, 'admin')

    await waitFor(() => {
      const patch = calls.find((c) => c.method === 'PATCH' && c.url.endsWith('/members/usr_pat'))
      expect(patch?.body).toEqual({ role: 'admin' })
    })
  })

  it('hides management from a plain member', async () => {
    mockApi([
      workspaces,
      unread,
      roster({
        members: [
          {
            userId: 'usr_me',
            email: 'operator@local',
            name: 'Operator',
            role: 'member',
            createdAt: '2026-08-01T00:00:00.000Z',
          },
        ],
      }),
    ])

    renderRoute('/w/settings/members')

    expect(await screen.findByText(/only an owner or admin/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /send invite/i })).not.toBeInTheDocument()
  })
})
