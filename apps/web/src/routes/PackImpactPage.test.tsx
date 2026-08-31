import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderRoute } from '../test/harness.js'

const report = (impacted: unknown[], upToDate = 0) => ({
  packKey: 'eaa-accessibility',
  currentSnapshotKey: 'EAA-IE-EN549-V3.2.1-DRAFT',
  upToDate,
  impacted,
})

const entity = {
  entityId: 'ent_1',
  name: 'Acme Bank Online',
  snapshotKey: 'EAA-IE-EN549-OLD',
  evaluationVersion: 1,
  addedControls: ['EAA-EN549-9-2-1-1'],
  removedControls: ['EAA-RETIRED-1'],
  orphanedClaims: 2,
}

const BASE = [{ path: '/api/v1/notifications/unread-count', method: 'GET', body: { count: 0 } }]

describe('PackImpactPage', () => {
  it('lists impacted entities and adopts one via re-evaluate', async () => {
    const user = userEvent.setup()
    let adopted = false
    const { calls } = mockApi([
      ...BASE,
      {
        path: '/api/v1/packs/eaa-accessibility/impact',
        method: 'GET',
        get body() {
          return adopted ? report([], 1) : report([entity])
        },
      },
      {
        path: '/api/v1/entities/ent_1/re-evaluate',
        method: 'POST',
        status: 201,
        get body() {
          adopted = true
          return {
            ok: true,
            version: 2,
            diff: { added: [], removed: [], applicabilityChanged: [] },
          }
        },
      },
    ])

    renderRoute('/w/packs/eaa-accessibility/impact')

    const table = await screen.findByRole('table')
    const row = within(table).getByText('Acme Bank Online').closest('tr')!
    expect(within(row).getByText('EAA-EN549-9-2-1-1')).toBeInTheDocument()
    expect(within(row).getByText('EAA-RETIRED-1')).toBeInTheDocument()

    await user.click(within(row).getByRole('button', { name: /adopt/i }))

    await waitFor(() => {
      expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/re-evaluate'))).toBe(true)
    })
    expect(
      await screen.findByText(/every entity on this pack is on the current snapshot/i),
    ).toBeInTheDocument()
  })

  it('shows the all-clear state', async () => {
    mockApi([
      ...BASE,
      { path: '/api/v1/packs/eaa-accessibility/impact', method: 'GET', body: report([], 3) },
    ])
    renderRoute('/w/packs/eaa-accessibility/impact')
    expect(
      await screen.findByText(/every entity on this pack is on the current snapshot/i),
    ).toBeInTheDocument()
  })
})
