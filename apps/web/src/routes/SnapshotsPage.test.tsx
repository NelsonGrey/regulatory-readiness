import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderRoute } from '../test/harness.js'

const summary = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'rsnap_1',
  entityId: 'ent_1',
  packKey: 'eaa-accessibility',
  snapshotKey: 'EAA-EN549-2025-06',
  evaluationId: 'eval_1',
  entityStatus: 'REVIEW_NEEDED',
  readinessCounts: { EVIDENCED: 2, MISSING: 1 },
  contentHash: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  createdBy: 'operator@local',
  createdAt: '2026-08-31T12:00:00.000Z',
  ...over,
})

describe('SnapshotsPage', () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:stub')
    global.URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  it('creates a snapshot and shows it in the list', async () => {
    const user = userEvent.setup()
    let created = false
    const { calls } = mockApi([
      {
        path: '/api/v1/entities/ent_1/readiness-snapshots',
        method: 'GET',
        get body() {
          return { snapshots: created ? [summary()] : [] }
        },
      },
      {
        path: '/api/v1/entities/ent_1/readiness-snapshots',
        method: 'POST',
        status: 201,
        get body() {
          created = true
          return {
            id: 'rsnap_1',
            contentHash: summary().contentHash,
            entityStatus: 'REVIEW_NEEDED',
            snapshotKey: 'EAA-EN549-2025-06',
            readinessCounts: { EVIDENCED: 2, MISSING: 1 },
            createdAt: '2026-08-31T12:00:00.000Z',
          }
        },
      },
    ])

    renderRoute('/w/entities/ent_1/snapshots')
    expect(await screen.findByText(/no snapshots yet/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /create readiness snapshot/i }))

    await waitFor(() => {
      expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/readiness-snapshots'))).toBe(
        true,
      )
    })
    expect(await screen.findByText('EAA-EN549-2025-06')).toBeInTheDocument()
    expect(screen.getByText(/review needed/i)).toBeInTheDocument()
  })

  it('downloads the canonical JSON and CSV exports of a snapshot', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi([
      {
        path: '/api/v1/entities/ent_1/readiness-snapshots',
        method: 'GET',
        body: { snapshots: [summary()] },
      },
      {
        path: '/api/v1/readiness-snapshots/rsnap_1/export.json',
        method: 'GET',
        body: { schemaVersion: '1.0', controls: [] },
      },
      {
        path: '/api/v1/readiness-snapshots/rsnap_1/export.csv',
        method: 'GET',
        body: 'control,title\r\nC-1,Text alternatives\r\n',
      },
    ])

    renderRoute('/w/entities/ent_1/snapshots')
    await screen.findByText('EAA-EN549-2025-06')

    await user.click(screen.getByRole('button', { name: 'JSON' }))
    await user.click(screen.getByRole('button', { name: 'CSV' }))

    await waitFor(() => {
      expect(calls.some((c) => c.url.endsWith('/export.json'))).toBe(true)
      expect(calls.some((c) => c.url.endsWith('/export.csv'))).toBe(true)
    })
    expect(global.URL.createObjectURL).toHaveBeenCalledTimes(2)
  })
})
