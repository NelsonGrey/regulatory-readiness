import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { mockApi, renderRoute } from '../test/harness.js'

const unread = { path: '/api/v1/notifications/unread-count', method: 'GET', body: { count: 0 } }
const workspaces = {
  path: '/api/v1/workspaces',
  method: 'GET',
  body: {
    workspaces: [{ id: 'demo-tenant', name: 'Demo', slug: 'demo', plan: 'trial', role: 'owner' }],
  },
}

describe('DashboardPage', () => {
  it('lists the workspace entities with status and readiness', async () => {
    mockApi([
      unread,
      workspaces,
      {
        path: '/api/v1/entities',
        method: 'GET',
        body: {
          entities: [
            {
              id: 'ent_1',
              name: 'Acme Storefront',
              entityIdentifier: 'acme-store',
              packKey: 'eaa-accessibility',
              entityKind: 'service',
              createdAt: '2026-09-01T00:00:00.000Z',
              snapshotKey: 'SNAP',
              evaluationVersion: 1,
              entityStatus: 'BLOCKED',
              readinessCounts: { EVIDENCED: 1, MISSING: 4 },
            },
          ],
        },
      },
    ])

    renderRoute('/')

    const row = await screen.findByTestId('entity-ent_1')
    expect(row).toHaveTextContent('Acme Storefront')
    expect(row).toHaveTextContent('Blocked')
    expect(row).toHaveTextContent('1 evidenced · 4 missing')
    expect(screen.getByRole('link', { name: 'Acme Storefront' })).toHaveAttribute(
      'href',
      '/w/entities/ent_1/matrix',
    )
  })

  it('shows the Get started card when there are no entities', async () => {
    mockApi([
      unread,
      workspaces,
      { path: '/api/v1/entities', method: 'GET', body: { entities: [] } },
    ])
    renderRoute('/')
    expect(await screen.findByTestId('onboarding-cta')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /get started/i })).toHaveAttribute(
      'href',
      '/w/onboarding',
    )
  })
})
