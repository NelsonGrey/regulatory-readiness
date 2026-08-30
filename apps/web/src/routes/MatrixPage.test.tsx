import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderRoute } from '../test/harness.js'

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
  rows: [
    {
      control: 'EAA-EN549-9-1-1-1',
      title: 'Text alternatives',
      family: 'web',
      standardClause: '9.1.1.1',
      wcagSc: '1.1.1 (A)',
      accessClassDefault: 'PUBLIC_CANDIDATE',
      applicability: 'REQUIRED_BY_SNAPSHOT',
    },
    {
      control: 'EAA-EN549-9-2-1-1',
      title: 'Keyboard',
      family: 'web',
      standardClause: '9.2.1.1',
      wcagSc: '2.1.1 (A)',
      accessClassDefault: 'PUBLIC_CANDIDATE',
      applicability: 'REQUIRED_BY_SNAPSHOT',
    },
    {
      control: 'EAA-EN549-9-2-4-11',
      title: 'Focus not obscured',
      family: 'web',
      standardClause: '9.2.4.11',
      wcagSc: '2.4.11 (AA)',
      accessClassDefault: 'PUBLIC_CANDIDATE',
      applicability: 'OPTIONAL_IF_AVAILABLE',
    },
    {
      control: 'EAA-EN549-10-1-1-1',
      title: 'Documents',
      family: 'non-web-documents',
      standardClause: '10.1.1.1',
      wcagSc: null,
      accessClassDefault: 'PUBLIC_CANDIDATE',
      applicability: 'NOT_APPLICABLE_TO_CLASSIFICATION',
      reason: 'No downloadable documents are in scope.',
    },
  ],
}

describe('MatrixPage', () => {
  it('renders the entity context, an honest denominator, and every control row', async () => {
    mockApi([{ path: '/api/v1/entities/ent_1/matrix', body: matrix }])
    renderRoute('/w/entities/ent_1/matrix')

    expect(await screen.findByRole('heading', { name: 'Acme Bank Online' })).toBeInTheDocument()
    expect(screen.getByText('EAA-IE-EN549-V3.2.1-DRAFT')).toBeInTheDocument()
    expect(screen.getByText(/2 of 4 controls are required by this snapshot/i)).toBeInTheDocument()
    expect(screen.getByText(/not a compliance score/i)).toBeInTheDocument()

    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(5) // header + 4
    expect(within(table).getByText('EAA-EN549-9-2-4-11')).toBeInTheDocument()
    expect(within(table).getByText('No downloadable documents are in scope.')).toBeInTheDocument()
  })

  it('filters rows by applicability when a summary chip is clicked', async () => {
    const user = userEvent.setup()
    mockApi([{ path: '/api/v1/entities/ent_1/matrix', body: matrix }])
    renderRoute('/w/entities/ent_1/matrix')

    await screen.findByRole('heading', { name: 'Acme Bank Online' })
    const summary = screen.getByRole('list', { name: /controls by applicability/i })
    await user.click(within(summary).getByRole('button', { name: /not applicable/i }))

    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(2) // header + the one N/A row
    expect(within(table).getByText('EAA-EN549-10-1-1-1')).toBeInTheDocument()
    expect(within(table).queryByText('EAA-EN549-9-1-1-1')).not.toBeInTheDocument()
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
