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

const noSources = {
  path: '/api/v1/admin/pack-sources',
  method: 'GET',
  body: { checks: [], openChanges: [] },
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
      noSources,
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
      noSources,
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
      noSources,
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

  it('runs a source sweep and acknowledges an open change', async () => {
    const user = userEvent.setup()
    let acked = false
    const { calls } = mockApi([
      unread,
      workspaces,
      { path: '/api/v1/admin/packs', method: 'GET', body: { packs: [overview()] } },
      {
        path: '/api/v1/admin/pack-sources',
        method: 'GET',
        get body() {
          return {
            checks: [
              {
                url: 'https://eur-lex.europa.eu/x',
                packKeys: ['eaa-accessibility'],
                lastHash: 'sha256:1',
                lastStatus: 'changed',
                lastCheckedAt: '2026-09-10T00:00:00.000Z',
                lastError: null,
              },
            ],
            openChanges: acked
              ? []
              : [
                  {
                    id: 'psc_1',
                    url: 'https://eur-lex.europa.eu/x',
                    packKeys: ['eaa-accessibility'],
                    fromHash: 'sha256:0',
                    toHash: 'sha256:1',
                    detectedAt: '2026-09-10T00:00:00.000Z',
                    acknowledgedBy: null,
                    acknowledgedAt: null,
                  },
                ],
          }
        },
      },
      { path: '/api/v1/admin/pack-sources/sweep', method: 'POST', body: { ok: true, changed: 1 } },
      {
        path: '/api/v1/admin/pack-sources/changes/psc_1/acknowledge',
        method: 'POST',
        get body() {
          acked = true
          return { ok: true }
        },
      },
    ])

    renderRoute('/w/admin/packs')

    const list = await screen.findByTestId('open-source-changes')
    expect(list).toHaveTextContent('eur-lex.europa.eu/x')

    await user.click(within(list).getByRole('button', { name: /acknowledge/i }))
    await waitFor(() => {
      expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/psc_1/acknowledge'))).toBe(
        true,
      )
    })
    expect(await screen.findByTestId('no-source-changes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /run source check now/i }))
    await waitFor(() => {
      expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/pack-sources/sweep'))).toBe(
        true,
      )
    })
  })
})
