import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderRoute } from '../test/harness.js'

const unreadStub = {
  path: '/api/v1/notifications/unread-count',
  method: 'GET',
  body: { count: 0 },
}

describe('DeletionPage', () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:stub')
    global.URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  it('downloads the full data export', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi([
      unreadStub,
      { path: '/api/v1/deletion-requests', method: 'GET', body: { deletionRequests: [] } },
      {
        path: '/api/v1/export/tenant',
        method: 'GET',
        body: JSON.stringify({
          schemaVersion: '1.0',
          tenantId: 'demo-tenant',
          counts: {},
          tables: {},
        }),
      },
    ])

    renderRoute('/w/settings/deletion')

    await user.click(await screen.findByRole('button', { name: /download all data/i }))

    await waitFor(() => {
      expect(calls.some((c) => c.url.endsWith('/export/tenant'))).toBe(true)
    })
    expect(global.URL.createObjectURL).toHaveBeenCalled()
  })

  it('runs the double-confirmed deletion and shows the receipt', async () => {
    const user = userEvent.setup()
    let requested = false
    let executed = false
    const { calls } = mockApi([
      unreadStub,
      {
        path: '/api/v1/deletion-requests',
        method: 'GET',
        get body() {
          return {
            deletionRequests: executed
              ? [
                  {
                    id: 'del_1',
                    tenantId: 'demo-tenant',
                    scope: 'tenant',
                    status: 'COMPLETED',
                    preview: { regulated_entity: 2 },
                    purged: { regulated_entity: 2 },
                    requestedBy: 'operator@local',
                    requestedAt: '2026-08-31T10:00:00.000Z',
                    completedBy: 'operator@local',
                    completedAt: '2026-08-31T10:01:00.000Z',
                  },
                ]
              : [],
          }
        },
      },
      {
        path: '/api/v1/deletion-requests',
        method: 'POST',
        status: 201,
        get body() {
          requested = true
          return { deletionRequestId: 'del_1', preview: { regulated_entity: 2, claim: 5 } }
        },
      },
      {
        path: '/api/v1/deletion-requests/del_1/execute',
        method: 'POST',
        get body() {
          executed = true
          return { ok: true, purged: { regulated_entity: 2, claim: 5 }, objectsRemoved: 3 }
        },
      },
    ])

    renderRoute('/w/settings/deletion')

    const beginBtn = await screen.findByRole('button', { name: /request deletion/i })
    expect(beginBtn).toBeDisabled()

    await user.type(screen.getByLabelText(/type the workspace id/i), 'demo-tenant')
    expect(beginBtn).toBeEnabled()
    await user.click(beginBtn)

    // preview appears
    expect(await screen.findByTestId('deletion-preview')).toBeInTheDocument()
    expect(requested).toBe(true)

    const deleteBtn = screen.getByRole('button', { name: /permanently delete everything/i })
    expect(deleteBtn).toBeDisabled()
    await user.type(screen.getByLabelText(/again to confirm/i), 'demo-tenant')
    expect(deleteBtn).toBeEnabled()
    await user.click(deleteBtn)

    expect(await screen.findByTestId('deletion-done')).toHaveTextContent(
      /7 rows and 3 stored file/i,
    )
    expect(calls.some((c) => c.url.endsWith('/del_1/execute'))).toBe(true)
    await waitFor(() => {
      expect(screen.getByText(/purged 2 rows/i)).toBeInTheDocument()
    })
  })

  it('surfaces a confirmation-mismatch error from the API', async () => {
    const user = userEvent.setup()
    mockApi([
      unreadStub,
      { path: '/api/v1/deletion-requests', method: 'GET', body: { deletionRequests: [] } },
      {
        path: '/api/v1/deletion-requests',
        method: 'POST',
        status: 422,
        body: {
          error: {
            code: 'CONFIRMATION_MISMATCH',
            message: 'the confirmation must equal the workspace id',
          },
        },
      },
    ])

    renderRoute('/w/settings/deletion')

    await user.type(await screen.findByLabelText(/type the workspace id/i), 'demo-tenant')
    await user.click(screen.getByRole('button', { name: /request deletion/i }))

    expect(await screen.findByText(/must equal the workspace id/i)).toBeInTheDocument()
  })
})
