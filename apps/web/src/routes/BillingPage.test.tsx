import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderRoute } from '../test/harness.js'

const unread = { path: '/api/v1/notifications/unread-count', method: 'GET', body: { count: 0 } }
const workspaces = {
  path: '/api/v1/workspaces',
  method: 'GET',
  body: {
    workspaces: [{ id: 'demo-tenant', name: 'Demo', slug: 'demo', plan: 'trial', role: 'owner' }],
  },
}

const trialSummary = {
  path: '/api/v1/billing',
  method: 'GET',
  body: {
    plan: 'trial',
    status: 'trialing',
    trialEndsAt: '2026-09-20T00:00:00.000Z',
    currentPeriodEnd: null,
    limits: { entities: 3, seats: 3 },
    usage: { entities: 3, seats: 2 },
  },
}

describe('BillingPage', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { ...window.location, assign: vi.fn() })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows the trial, usage vs limits, and flags a maxed resource', async () => {
    mockApi([unread, workspaces, trialSummary])
    renderRoute('/w/settings/billing')

    expect(await screen.findByText(/trial ends/i)).toBeInTheDocument()
    const entities = await screen.findByTestId('usage-entities')
    expect(entities).toHaveAttribute('data-over', 'true')
    expect(entities).toHaveTextContent('Entities3')
    expect(screen.getByTestId('usage-seats')).not.toHaveAttribute('data-over')
  })

  it('starts a checkout and redirects to the provider URL', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi([
      unread,
      workspaces,
      trialSummary,
      {
        path: '/api/v1/billing/checkout',
        method: 'POST',
        body: { url: 'https://pay.example/session/abc' },
      },
    ])
    renderRoute('/w/settings/billing')

    await user.click(await screen.findByRole('button', { name: /upgrade to starter/i }))

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/billing/checkout'))
      expect(post?.body).toEqual({ plan: 'starter' })
    })
    expect(window.location.assign).toHaveBeenCalledWith('https://pay.example/session/abc')
  })
})
