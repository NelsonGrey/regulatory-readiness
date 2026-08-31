import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderRoute } from '../test/harness.js'

const packsEmpty = { path: '/api/v1/packs', method: 'GET', body: { packs: [] } }
const unread = { path: '/api/v1/notifications/unread-count', method: 'GET', body: { count: 0 } }

const twoWorkspaces = {
  path: '/api/v1/workspaces',
  method: 'GET',
  body: {
    workspaces: [
      { id: 'demo-tenant', name: 'Demo', slug: 'demo', plan: 'trial', role: 'owner' },
      { id: 'wsp_two', name: 'Second Co', slug: 'second', plan: 'trial', role: 'member' },
    ],
  },
}

describe('Shell', () => {
  it('shows the sign-in stand-in when signed out', async () => {
    const user = userEvent.setup()
    mockApi([twoWorkspaces, unread, packsEmpty])
    renderRoute('/', { signedOut: true })

    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument()
    await user.type(screen.getByLabelText(/work email/i), 'me@acme.test')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // now inside the app — the workspace picker is present
    expect(await screen.findByLabelText(/workspace/i)).toBeInTheDocument()
  })

  it('lists the caller’s workspaces and switches between them', async () => {
    const user = userEvent.setup()
    mockApi([twoWorkspaces, unread, packsEmpty])
    renderRoute('/')

    const picker = await screen.findByLabelText(/workspace/i)
    expect(
      within(picker)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Demo', 'Second Co'])

    await user.selectOptions(picker, 'wsp_two')
    await waitFor(() => expect(localStorage.getItem('rre.tenant')).toBe('wsp_two'))
  })

  it('prompts to create a first workspace when the caller has none', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi([
      { path: '/api/v1/workspaces', method: 'GET', body: { workspaces: [] } },
      unread,
      packsEmpty,
      {
        path: '/api/v1/sign-up',
        method: 'POST',
        status: 201,
        body: {
          workspace: { id: 'wsp_new', name: 'Acme', slug: 'acme', plan: 'trial' },
          role: 'owner',
        },
      },
    ])
    renderRoute('/')

    expect(
      await screen.findByRole('heading', { name: /create your workspace/i }),
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText(/workspace name/i), 'Acme')
    await user.click(screen.getByRole('button', { name: /create workspace/i }))

    await waitFor(() => {
      expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/api/v1/sign-up'))).toBe(true)
    })
  })
})
