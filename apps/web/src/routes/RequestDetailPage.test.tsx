import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderRoute } from '../test/harness.js'

const detail = (over: Partial<Record<string, unknown>> = {}) => ({
  request: {
    id: 'req_abcdef123456',
    entityId: 'ent_1',
    packKey: 'eaa-accessibility',
    status: 'SUBMITTED',
    message: 'Please answer by Friday',
    dueAt: null,
    createdBy: 'operator@local',
    createdAt: '2026-08-30T10:00:00.000Z',
  },
  items: [
    {
      id: 'rqi_1',
      requestId: 'req_abcdef123456',
      controlKey: 'EAA-1',
      instructions: null,
      requiredInRequest: true,
    },
  ],
  grants: [
    {
      tokenPrefix: 'tok_secr',
      expiresAt: '2026-09-20T00:00:00.000Z',
      revokedAt: null,
      uses: 1,
    },
  ],
  submissions: [
    {
      id: 'sub_1',
      version: 1,
      submittedAt: '2026-08-31T09:00:00.000Z',
      responses: [
        {
          id: 'rsi_1',
          controlKey: 'EAA-1',
          value: 'alt text present on all images',
          unit: null,
          availabilityState: 'VALUE_SUPPLIED',
        },
      ],
    },
  ],
  ...over,
})

describe('RequestDetailPage', () => {
  it('shows the submission and accepts a response into review', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi([
      { path: '/api/v1/requests/req_abcdef123456', method: 'GET', body: detail() },
      {
        path: '/api/v1/submissions/sub_1/items/rsi_1/accept',
        method: 'POST',
        status: 201,
        body: { claimId: 'clm_9' },
      },
    ])

    renderRoute('/w/entities/ent_1/requests/req_abcdef123456')

    expect(await screen.findByText('alt text present on all images')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /accept into review/i }))

    await waitFor(() => {
      expect(
        calls.some(
          (c) => c.method === 'POST' && c.url.includes('/submissions/sub_1/items/rsi_1/accept'),
        ),
      ).toBe(true)
    })
  })

  it('revokes the active link', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi([
      { path: '/api/v1/requests/req_abcdef123456', method: 'GET', body: detail() },
      {
        path: '/api/v1/requests/req_abcdef123456/revoke',
        method: 'POST',
        body: { ok: true },
      },
    ])

    renderRoute('/w/entities/ent_1/requests/req_abcdef123456')
    await screen.findByText('alt text present on all images')

    await user.click(screen.getByRole('button', { name: /revoke link/i }))

    await waitFor(() => {
      expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/revoke'))).toBe(true)
    })
  })

  it('reissues the link and shows the new URL once', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi([
      { path: '/api/v1/requests/req_abcdef123456', method: 'GET', body: detail() },
      {
        path: '/api/v1/requests/req_abcdef123456/resend',
        method: 'POST',
        status: 201,
        body: {
          token: 'tok_reissued_value',
          tokenPrefix: 'tok_reis',
          expiresAt: '2026-09-30T00:00:00.000Z',
          status: 'SENT',
          contributorPath: '/contributor/v1/requests/tok_reissued_value',
        },
      },
    ])

    renderRoute('/w/entities/ent_1/requests/req_abcdef123456')
    await screen.findByText('alt text present on all images')

    await user.click(screen.getByRole('button', { name: /reissue link/i }))

    await waitFor(() => {
      expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/resend'))).toBe(true)
    })
    expect(await screen.findByText(/new link — copy it now/i)).toBeInTheDocument()
    expect(screen.getByText(/\/contribute\/tok_reissued_value$/)).toBeInTheDocument()
  })

  it('renders a not-found message for an unknown request', async () => {
    mockApi([
      {
        path: '/api/v1/requests/req_missing',
        method: 'GET',
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: 'request not found' } },
      },
    ])

    renderRoute('/w/entities/ent_1/requests/req_missing')
    expect(await screen.findByText(/request not found in this workspace/i)).toBeInTheDocument()
  })
})
