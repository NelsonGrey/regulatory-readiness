import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { mockApi, renderRoute } from '../test/harness.js'

const unread = { path: '/api/v1/notifications/unread-count', method: 'GET', body: { count: 0 } }
const workspaces = {
  path: '/api/v1/workspaces',
  method: 'GET',
  body: { workspaces: [] },
}

describe('JoinPage', () => {
  it('accepts an invite and confirms the workspace joined', async () => {
    mockApi([
      unread,
      workspaces,
      {
        path: '/api/v1/invites/accept',
        method: 'POST',
        body: { workspace: { id: 'wsp_joined', name: 'Beta Corp' }, role: 'member' },
      },
    ])

    renderRoute('/join/tok_123')

    expect(await screen.findByRole('heading', { name: /you’re in/i })).toBeInTheDocument()
    expect(screen.getByText(/Beta Corp/)).toBeInTheDocument()
    expect(localStorage.getItem('rre.tenant')).toBe('wsp_joined')
  })

  it('surfaces an invite that is for a different email', async () => {
    mockApi([
      unread,
      workspaces,
      {
        path: '/api/v1/invites/accept',
        method: 'POST',
        status: 409,
        body: {
          error: { code: 'EMAIL_MISMATCH', message: 'this invite is for a different email' },
        },
      },
    ])

    renderRoute('/join/tok_x')

    expect(await screen.findByText(/different email/i)).toBeInTheDocument()
  })
})
