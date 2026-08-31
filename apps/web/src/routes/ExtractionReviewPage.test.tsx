import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderRoute } from '../test/harness.js'

const run = {
  id: 'xrun_1',
  documentId: 'doc_1',
  entityId: 'ent_1',
  extractorName: 'keyword',
  modelId: 'keyword-lines@1',
  status: 'COMPLETED',
  error: null,
  proposalCount: 1,
  startedBy: 'operator@local',
  startedAt: '2026-08-31T12:00:00.000Z',
  finishedAt: '2026-08-31T12:00:01.000Z',
}

const proposal = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'xprp_1',
  runId: 'xrun_1',
  documentId: 'doc_1',
  controlKey: 'EAA-EN549-9-2-1-1',
  value: 'fully operable by keyboard',
  unit: null,
  method: 'line 2 of the document',
  confidence: 0.6,
  page: null,
  quote: 'Keyboard: fully operable by keyboard',
  validation: [],
  status: 'PENDING',
  reason: null,
  acceptedClaimId: null,
  ...over,
})

const BASE_STUBS = [
  { path: '/api/v1/notifications/unread-count', method: 'GET', body: { count: 0 } },
]

describe('ExtractionReviewPage', () => {
  it('runs an extraction, lists proposals, and accepts one', async () => {
    const user = userEvent.setup()
    let ran = false
    let accepted = false
    const { calls } = mockApi([
      ...BASE_STUBS,
      {
        path: '/api/v1/entities/ent_1/documents/doc_1/extractions',
        method: 'GET',
        get body() {
          return { runs: ran ? [run] : [] }
        },
      },
      {
        path: '/api/v1/entities/ent_1/documents/doc_1/extractions',
        method: 'POST',
        status: 201,
        get body() {
          ran = true
          return { runId: 'xrun_1', proposalCount: 1 }
        },
      },
      {
        path: '/api/v1/extractions/xrun_1',
        method: 'GET',
        get body() {
          return {
            run,
            proposals: [proposal(accepted ? { status: 'ACCEPTED', acceptedClaimId: 'clm_9' } : {})],
          }
        },
      },
      {
        path: '/api/v1/extraction-proposals/xprp_1/accept',
        method: 'POST',
        status: 201,
        get body() {
          accepted = true
          return { claimId: 'clm_9' }
        },
      },
    ])

    renderRoute('/w/entities/ent_1/documents/doc_1/extractions')
    expect(await screen.findByText(/no extraction has been run yet/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /run extraction/i }))

    expect(await screen.findByText('EAA-EN549-9-2-1-1')).toBeInTheDocument()
    expect(screen.getByText(/keyboard: fully operable/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /accept as a claim/i }))

    await waitFor(() => {
      expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/accept'))).toBe(true)
    })
    expect(await screen.findByText(/accepted → claim clm_9/i)).toBeInTheDocument()
  })

  it('shows the extracted-proposal disclaimer and a validation error', async () => {
    mockApi([
      ...BASE_STUBS,
      {
        path: '/api/v1/entities/ent_1/documents/doc_1/extractions',
        method: 'GET',
        body: { runs: [run] },
      },
      {
        path: '/api/v1/extractions/xrun_1',
        method: 'GET',
        body: {
          run,
          proposals: [
            proposal({
              validation: [
                { level: 'error', code: 'EMPTY', message: 'the proposed value is empty' },
              ],
            }),
          ],
        },
      },
    ])

    renderRoute('/w/entities/ent_1/documents/doc_1/extractions')
    expect(await screen.findByText(/extracted proposals/i)).toBeInTheDocument()
    expect(screen.getByText(/the proposed value is empty/i)).toBeInTheDocument()
  })
})
