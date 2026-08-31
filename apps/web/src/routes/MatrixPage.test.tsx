import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderRoute } from '../test/harness.js'

const row = (over: Partial<Record<string, unknown>>) => ({
  control: 'C',
  title: 'T',
  family: 'web',
  standardClause: null,
  wcagSc: null,
  accessClassDefault: 'PUBLIC_CANDIDATE',
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
    name: 'Acme Bank Online',
    packKey: 'eaa-accessibility',
    entityKind: 'service',
    entityIdentifier: 'acme',
  },
  evaluation: {
    id: 'ev_1',
    snapshotKey: 'EAA-IE-EN549-V3.2.1-DRAFT',
    evaluatedAt: '2026-08-30T12:00:00.000Z',
    hash: 'sha256:abcdef0123456789abcdef',
    version: 1,
  },
  summary: {
    total: 4,
    requiredNow: 2,
    optional: 1,
    conditional: 0,
    notApplicable: 1,
    notYetRequired: 0,
    needsSpecialistReview: 0,
    duplicate: 0,
  },
  entityStatus: 'BLOCKED',
  readinessCounts: { EVIDENCED: 1, MISSING: 2, NOT_APPLICABLE: 1 },
  rows: [
    row({
      control: 'EAA-9-1-1-1',
      title: 'Text alternatives',
      readiness: 'EVIDENCED',
      approvedValue: 'alt text present',
      approvedUnit: null,
    }),
    row({
      control: 'EAA-9-2-1-1',
      title: 'Keyboard',
      readiness: 'MISSING',
      evidenceExpectation:
        'Keyboard-only walkthrough notes for each key flow, with tester and date.',
    }),
    row({
      control: 'EAA-9-2-4-11',
      title: 'Focus',
      applicability: 'OPTIONAL_IF_AVAILABLE',
      readiness: 'MISSING',
    }),
    row({
      control: 'EAA-10-1-1-1',
      title: 'Documents',
      applicability: 'NOT_APPLICABLE_TO_CLASSIFICATION',
      readiness: 'NOT_APPLICABLE',
      reason: 'No downloadable documents are in scope.',
    }),
  ],
}

describe('MatrixPage', () => {
  it('shows the entity-status banner, a readiness column, and the approved value', async () => {
    mockApi([{ path: '/api/v1/entities/ent_1/matrix', body: matrix }])
    renderRoute('/w/entities/ent_1/matrix')

    expect(await screen.findByRole('heading', { name: 'Acme Bank Online' })).toBeInTheDocument()
    expect(screen.getByText(/blocked — required evidence is missing/i)).toBeInTheDocument()
    expect(screen.getByText(/no compliance score/i)).toBeInTheDocument()

    const table = screen.getByRole('table')
    const evidencedRow = within(table).getByText('EAA-9-1-1-1').closest('tr')!
    expect(within(evidencedRow).getByText('Evidenced')).toBeInTheDocument()
    expect(within(evidencedRow).getByText('alt text present')).toBeInTheDocument()

    // the readiness summary is clickable and filters the table
    const summary = screen.getByRole('list', { name: /controls by readiness/i })
    await userEvent.setup().click(within(summary).getByRole('button', { name: /evidenced/i }))
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2) // header + 1
    expect(within(screen.getByRole('table')).queryByText('EAA-9-2-1-1')).not.toBeInTheDocument()
  })

  it('records a claim through the inline form and refetches the matrix', async () => {
    const user = userEvent.setup()
    const afterClaim = {
      ...matrix,
      rows: matrix.rows.map((r) =>
        r.control === 'EAA-9-2-1-1' ? { ...r, readiness: 'PENDING_REVIEW', pendingClaims: 1 } : r,
      ),
    }
    let calls = 0
    const { calls: recorded } = mockApi([
      {
        path: '/api/v1/entities/ent_1/matrix',
        method: 'GET',
        get body() {
          return calls++ === 0 ? matrix : afterClaim
        },
      },
      {
        path: '/api/v1/entities/ent_1/controls/EAA-9-2-1-1/claims',
        method: 'POST',
        status: 201,
        body: { claim: { id: 'clm_1', status: 'PENDING_REVIEW' } },
      },
    ])

    renderRoute('/w/entities/ent_1/matrix')
    const table = await screen.findByRole('table')
    const keyboardRow = within(table).getByText('EAA-9-2-1-1').closest('tr')!
    await user.click(within(keyboardRow).getByRole('button', { name: /add claim/i }))

    // the claim form shows the pack-authored evidence guidance for this control
    expect(await screen.findByTestId('evidence-expectation')).toHaveTextContent(
      /keyboard-only walkthrough notes/i,
    )

    await user.type(screen.getByLabelText(/^value/i), 'keyboard operable')
    await user.click(screen.getByRole('button', { name: /submit for review/i }))

    await waitFor(() => {
      expect(
        recorded.some((c) => c.method === 'POST' && c.url.includes('/controls/EAA-9-2-1-1/claims')),
      ).toBe(true)
    })
    // the refetched matrix shows the pending badge
    expect(await screen.findByText(/1 pending/i)).toBeInTheDocument()
  })

  it('marks an overridden control and records a new override through the inline form', async () => {
    const user = userEvent.setup()
    const overridden = {
      ...matrix,
      rows: matrix.rows.map((r) =>
        r.control === 'EAA-9-2-1-1'
          ? {
              ...r,
              applicability: 'NOT_APPLICABLE_TO_CLASSIFICATION',
              readiness: 'NOT_APPLICABLE',
              originalApplicability: 'REQUIRED_BY_SNAPSHOT',
              overrideRationale: 'covered by the design system',
            }
          : r,
      ),
    }
    let calls = 0
    const { calls: recorded } = mockApi([
      {
        path: '/api/v1/entities/ent_1/matrix',
        method: 'GET',
        get body() {
          return calls++ === 0 ? matrix : overridden
        },
      },
      {
        path: '/api/v1/entities/ent_1/controls/EAA-9-2-1-1/applicability-override',
        method: 'POST',
        status: 201,
        body: { override: { id: 'aov_1' } },
      },
    ])

    renderRoute('/w/entities/ent_1/matrix')
    const table = await screen.findByRole('table')
    const kbRow = within(table).getByText('EAA-9-2-1-1').closest('tr')!

    await user.click(within(kbRow).getByRole('button', { name: /^override$/i }))
    await user.type(screen.getByLabelText(/rationale/i), 'covered by the design system')
    await user.selectOptions(
      screen.getByLabelText(/new applicability/i),
      'NOT_APPLICABLE_TO_CLASSIFICATION',
    )
    await user.click(screen.getByRole('button', { name: /record override/i }))

    await waitFor(() => {
      const post = recorded.find(
        (c) => c.method === 'POST' && c.url.endsWith('/applicability-override'),
      )
      expect(post?.body).toMatchObject({
        result: 'NOT_APPLICABLE_TO_CLASSIFICATION',
        rationale: 'covered by the design system',
      })
    })
    expect(await screen.findByText(/overridden from REQUIRED_BY_SNAPSHOT/i)).toBeInTheDocument()
  })

  it('re-evaluates applicability and shows the change summary', async () => {
    const user = userEvent.setup()
    let calls = 0
    const bumped = { ...matrix, evaluation: { ...matrix.evaluation, version: 2 } }
    const { calls: recorded } = mockApi([
      {
        path: '/api/v1/entities/ent_1/matrix',
        method: 'GET',
        get body() {
          return calls++ === 0 ? matrix : bumped
        },
      },
      {
        path: '/api/v1/entities/ent_1/re-evaluate',
        method: 'POST',
        status: 201,
        body: {
          ok: true,
          evaluationId: 'eval_2',
          version: 2,
          snapshotKey: 'EAA-IE-EN549-V3.2.1-DRAFT',
          diff: {
            added: [],
            removed: ['EAA-9-2-4-11'],
            applicabilityChanged: [
              {
                control: 'EAA-9-2-1-1',
                from: 'REQUIRED_BY_SNAPSHOT',
                to: 'NOT_APPLICABLE_TO_CLASSIFICATION',
              },
            ],
            unchanged: 2,
          },
        },
      },
    ])

    renderRoute('/w/entities/ent_1/matrix')
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: /re-evaluate applicability/i }))

    await waitFor(() => {
      expect(recorded.some((c) => c.method === 'POST' && c.url.endsWith('/re-evaluate'))).toBe(true)
    })
    const banner = (await screen.findByText(/re-evaluated to v2/i)).closest('.rre-panel')!
    expect(banner.textContent).toMatch(/0 added · 1 removed · 1 applicability change/i)
    expect(banner.textContent).toContain('EAA-9-2-1-1')
    expect(banner.textContent).toContain('REQUIRED_BY_SNAPSHOT → NOT_APPLICABLE_TO_CLASSIFICATION')
  })

  it('shows a not-found message for an unknown entity', async () => {
    mockApi([
      {
        path: '/api/v1/entities/ent_x/matrix',
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: 'entity not found' } },
      },
    ])
    renderRoute('/w/entities/ent_x/matrix')
    expect(await screen.findByText(/entity not found in this workspace/i)).toBeInTheDocument()
  })
})
