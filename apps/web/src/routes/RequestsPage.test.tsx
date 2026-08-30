import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderRoute } from '../test/harness.js'

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  control: 'EAA-1',
  title: 'Text alternatives',
  family: 'Perceivable',
  standardClause: null,
  wcagSc: null,
  accessClassDefault: 'A',
  applicability: 'REQUIRED_BY_SNAPSHOT',
  readiness: 'MISSING',
  approvedValue: null,
  approvedUnit: null,
  pendingClaims: 0,
  ...over,
})

const matrix = {
  entity: {
    id: 'ent_1',
    name: 'Acme Storefront',
    packKey: 'eaa-accessibility',
    entityKind: 'service',
    entityIdentifier: 'acme',
  },
  evaluation: { id: 'ev_1', snapshotKey: 'SNAP-1', evaluatedAt: '', hash: 'sha256:x', version: 1 },
  summary: {
    total: 2,
    requiredNow: 1,
    optional: 0,
    conditional: 0,
    notApplicable: 1,
    notYetRequired: 0,
    needsSpecialistReview: 0,
    duplicate: 0,
  },
  entityStatus: 'REVIEW_NEEDED',
  readinessCounts: {},
  rows: [
    row(),
    row({
      control: 'EAA-2',
      title: 'Captions',
      applicability: 'NOT_APPLICABLE_TO_CLASSIFICATION',
      readiness: 'NOT_APPLICABLE',
    }),
  ],
}

describe('RequestsPage', () => {
  it('offers only applicable controls and reveals the one-time link after creating a request', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi([
      { path: '/api/v1/entities/ent_1/matrix', method: 'GET', body: matrix },
      {
        path: '/api/v1/entities/ent_1/requests',
        method: 'GET',
        body: { requests: [] },
      },
      {
        path: '/api/v1/entities/ent_1/requests',
        method: 'POST',
        status: 201,
        body: {
          request: {
            id: 'req_1',
            entityId: 'ent_1',
            packKey: 'eaa-accessibility',
            status: 'DRAFT',
          },
          items: [{ id: 'rqi_1', requestId: 'req_1', controlKey: 'EAA-1' }],
          token: 'tok_secret_value',
          tokenPrefix: 'tok_secr',
          expiresAt: '2026-09-20T00:00:00.000Z',
          contributorPath: '/contributor/v1/requests/tok_secret_value',
        },
      },
    ])

    renderRoute('/w/entities/ent_1/requests')

    expect(await screen.findByText('EAA-1')).toBeInTheDocument()
    // The not-applicable control is not offered.
    expect(screen.queryByText('EAA-2')).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /create request \(1\)/i }))

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST')
      expect(post?.body).toEqual({ controlKeys: ['EAA-1'], expiresInDays: 14 })
    })

    expect(await screen.findByText(/share this link once/i)).toBeInTheDocument()
    expect(screen.getByText(/\/contribute\/tok_secret_value$/)).toBeInTheDocument()
  })

  it('lists existing requests with a link to each', async () => {
    mockApi([
      { path: '/api/v1/entities/ent_1/matrix', method: 'GET', body: matrix },
      {
        path: '/api/v1/entities/ent_1/requests',
        method: 'GET',
        body: {
          requests: [
            {
              id: 'req_abcdef123456',
              entityId: 'ent_1',
              packKey: 'eaa-accessibility',
              status: 'SENT',
              message: null,
              dueAt: null,
              createdBy: 'operator@local',
              createdAt: '2026-08-30T10:00:00.000Z',
            },
          ],
        },
      },
    ])

    renderRoute('/w/entities/ent_1/requests')

    expect(await screen.findByText('SENT')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /open →/i })
    expect(link).toHaveAttribute('href', '/w/entities/ent_1/requests/req_abcdef123456')
  })
})
