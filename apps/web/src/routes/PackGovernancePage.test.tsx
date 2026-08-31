import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
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

const overview = (over: Partial<Record<string, unknown>> = {}) => ({
  packKey: 'eaa-accessibility',
  title: 'EU Accessibility Act',
  onDiskStatus: 'draft',
  computedChecksum: 'sha256:abcdef0123456789',
  valid: true,
  issues: [],
  reviews: [{ reviewer: 'ann@rre.test', note: null, at: '2026-09-01T00:00:00.000Z' }],
  distinctReviewers: 1,
  activation: null,
  effectiveStatus: 'draft',
  driftedSinceActivation: false,
  canActivate: false,
  blockers: ['NEEDS_REVIEWS (1/2)'],
  ...over,
})

describe('PackGovernancePage', () => {
  it('renders the governance table and adds a review', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi([
      unread,
      workspaces,
      { path: '/api/v1/admin/packs', method: 'GET', body: { packs: [overview()] } },
      { path: '/api/v1/admin/packs/eaa-accessibility/reviews', method: 'POST', body: { ok: true } },
    ])

    renderRoute('/w/admin/packs')

    const rowEl = await screen.findByTestId('pack-eaa-accessibility')
    expect(rowEl).toHaveTextContent('1 / 2')
    expect(rowEl).toHaveTextContent('NEEDS_REVIEWS (1/2)')
    expect(within(rowEl).getByRole('button', { name: /^activate$/i })).toBeDisabled()

    await user.click(within(rowEl).getByRole('button', { name: /add my review/i }))
    await waitFor(() => {
      expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/reviews'))).toBe(true)
    })
  })

  it('enables Activate when the pack is ready, and shows drift', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi([
      unread,
      workspaces,
      {
        path: '/api/v1/admin/packs',
        method: 'GET',
        body: {
          packs: [
            overview({ distinctReviewers: 2, canActivate: true, blockers: [] }),
            overview({
              packKey: 'eu-battery-passport',
              title: 'EU Batteries Regulation',
              effectiveStatus: 'draft',
              driftedSinceActivation: true,
              activation: {
                packKey: 'eu-battery-passport',
                checksum: 'sha256:stale',
                status: 'active',
                activatedBy: 'ops@rre.test',
                activatedAt: '2026-08-01T00:00:00.000Z',
                withdrawnBy: null,
                withdrawnAt: null,
              },
            }),
          ],
        },
      },
      {
        path: '/api/v1/admin/packs/eaa-accessibility/activate',
        method: 'POST',
        body: { ok: true },
      },
    ])

    renderRoute('/w/admin/packs')

    const eaa = await screen.findByTestId('pack-eaa-accessibility')
    await user.click(within(eaa).getByRole('button', { name: /^activate$/i }))
    await waitFor(() => {
      expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/activate'))).toBe(true)
    })

    expect(screen.getByTestId('pack-eu-battery-passport')).toHaveTextContent(/re-review/i)
  })

  it('shows a clear message for a non-admin', async () => {
    mockApi([
      unread,
      workspaces,
      {
        path: '/api/v1/admin/packs',
        method: 'GET',
        status: 403,
        body: { error: { code: 'NOT_PLATFORM_ADMIN', message: 'platform administrator only' } },
      },
    ])
    renderRoute('/w/admin/packs')
    expect(await screen.findByText(/not a platform administrator/i)).toBeInTheDocument()
  })
})
