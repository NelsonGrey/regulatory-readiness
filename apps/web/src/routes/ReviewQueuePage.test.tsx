import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderRoute } from '../test/harness.js'

const claim = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'clm_1',
  controlKey: 'EAA-9-2-1-1',
  value: 'keyboard operable',
  unit: null,
  origin: 'INTERNAL_ASSERTION',
  status: 'PENDING_REVIEW',
  revision: 1,
  assertedBy: 'manager@acme',
  assertedAt: '2026-08-30T12:00:00.000Z',
  ...over,
})

describe('ReviewQueuePage', () => {
  it('lists pending claims and approves one, then refreshes', async () => {
    const user = userEvent.setup()
    let calls = 0
    const { calls: recorded } = mockApi([
      {
        path: '/api/v1/entities/ent_1/review-queue',
        method: 'GET',
        get body() {
          return calls++ === 0
            ? { entityId: 'ent_1', items: [claim()] }
            : { entityId: 'ent_1', items: [] }
        },
      },
      {
        path: '/api/v1/claims/clm_1/decisions',
        method: 'POST',
        body: { claim: claim({ status: 'APPROVED' }) },
      },
    ])

    renderRoute('/w/entities/ent_1/review')

    expect(await screen.findByText('EAA-9-2-1-1')).toBeInTheDocument()
    expect(screen.getByText('keyboard operable')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /approve/i }))

    await waitFor(() => {
      const post = recorded.find((c) => c.method === 'POST')
      expect(post?.body).toEqual({ decision: 'APPROVED' })
    })
    expect(await screen.findByText(/nothing is awaiting review/i)).toBeInTheDocument()
  })

  it('sends the reason with a rejection and surfaces a server error', async () => {
    const user = userEvent.setup()
    const { calls: recorded } = mockApi([
      {
        path: '/api/v1/entities/ent_1/review-queue',
        method: 'GET',
        body: { entityId: 'ent_1', items: [claim()] },
      },
      {
        path: '/api/v1/claims/clm_1/decisions',
        method: 'POST',
        status: 422,
        body: { error: { code: 'REASON_REQUIRED', message: 'a reason is required to reject' } },
      },
    ])

    renderRoute('/w/entities/ent_1/review')
    await screen.findByText('EAA-9-2-1-1')

    await user.type(screen.getByLabelText(/reason/i), 'unit is wrong')
    await user.click(screen.getByRole('button', { name: /reject/i }))

    await waitFor(() => {
      const post = recorded.find((c) => c.method === 'POST')
      expect(post?.body).toEqual({ decision: 'REJECTED', reason: 'unit is wrong' })
    })
    expect(await screen.findByText(/a reason is required to reject/i)).toBeInTheDocument()
  })

  it('shows the empty state when nothing awaits review', async () => {
    mockApi([
      {
        path: '/api/v1/entities/ent_1/review-queue',
        method: 'GET',
        body: { entityId: 'ent_1', items: [] },
      },
    ])
    renderRoute('/w/entities/ent_1/review')
    expect(await screen.findByText(/nothing is awaiting review/i)).toBeInTheDocument()
  })
})
