import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
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
      { path: '/api/v1/documents', method: 'GET', body: { documents: [] } },
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
      { path: '/api/v1/documents', method: 'GET', body: { documents: [] } },
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
      { path: '/api/v1/documents', method: 'GET', body: { documents: [] } },
      {
        path: '/api/v1/entities/ent_1/review-queue',
        method: 'GET',
        body: { entityId: 'ent_1', items: [] },
      },
    ])
    renderRoute('/w/entities/ent_1/review')
    expect(await screen.findByText(/nothing is awaiting review/i)).toBeInTheDocument()
  })

  it('attaches an available document to a claim as evidence', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi([
      {
        path: '/api/v1/documents',
        method: 'GET',
        body: {
          documents: [
            { id: 'doc_1', filename: 'audit.pdf', status: 'AVAILABLE' },
            { id: 'doc_2', filename: 'draft.pdf', status: 'UPLOADING' },
          ],
        },
      },
      {
        path: '/api/v1/entities/ent_1/review-queue',
        method: 'GET',
        body: { entityId: 'ent_1', items: [claim()] },
      },
      {
        path: '/api/v1/claims/clm_1/evidence',
        method: 'POST',
        status: 201,
        body: { evidenceLocationId: 'evl_1', linkId: 'cel_1' },
      },
    ])

    renderRoute('/w/entities/ent_1/review')
    await screen.findByText('EAA-9-2-1-1')

    // only the AVAILABLE document is offered
    const select = screen.getByLabelText(/attach evidence/i)
    expect(within(select).queryByText('draft.pdf')).not.toBeInTheDocument()

    await user.selectOptions(select, 'doc_1')
    await user.type(screen.getByLabelText(/quoted text/i), 'keyboard operable')
    await user.click(screen.getByRole('button', { name: /^attach$/i }))

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST' && c.url.endsWith('/evidence'))
      expect(post?.body).toMatchObject({ documentId: 'doc_1', quote: 'keyboard operable' })
    })
    expect(await screen.findByText(/1 document\(s\) attached/i)).toBeInTheDocument()
  })
})
