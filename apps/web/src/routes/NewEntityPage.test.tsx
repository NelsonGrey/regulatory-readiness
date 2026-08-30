import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderRoute } from '../test/harness.js'

const packsStub = {
  path: '/api/v1/packs',
  method: 'GET',
  body: {
    packs: [
      {
        packKey: 'eaa-accessibility',
        title: 'EU Accessibility Act',
        jurisdiction: 'IE',
        status: 'draft',
        snapshotKey: 'SNAP',
        valid: true,
      },
    ],
  },
}

const packDetailStub = {
  path: '/api/v1/packs/eaa-accessibility',
  method: 'GET',
  body: {
    packKey: 'eaa-accessibility',
    title: 'EU Accessibility Act',
    jurisdiction: 'IE',
    snapshotKey: 'SNAP',
    status: 'draft',
    valid: true,
    controlCount: 20,
    controlFamilies: [{ family: 'web', count: 9 }],
    entityFacts: [
      { name: 'entityKind', type: 'enum', enumValues: ['product', 'service'], required: true },
      {
        name: 'offeredToConsumersInIE',
        type: 'boolean',
        required: true,
        description: 'Offered in Ireland?',
      },
      {
        name: 'serviceType',
        type: 'enum',
        enumValues: ['ecommerce', 'consumer_banking'],
        required: false,
      },
    ],
    copy: { limitationStatement: 'not a certification', forbiddenPhrases: ['fully accessible'] },
  },
}

describe('NewEntityPage', () => {
  it('renders a form from the pack fact schema and posts a create request', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi([
      packsStub,
      packDetailStub,
      {
        path: '/api/v1/entities',
        method: 'POST',
        status: 201,
        body: {
          entity: { id: 'ent_123' },
          evaluation: { id: 'e', snapshotKey: 'SNAP', hash: 'sha256:x', version: 1 },
        },
      },
      { path: '/api/v1/entities/ent_123/matrix', method: 'GET', body: matrixBody('ent_123') },
    ])

    renderRoute('/w/entities/new')

    await user.selectOptions(
      await screen.findByLabelText(/regulation \(control pack\)/i),
      'eaa-accessibility',
    )

    // A field generated from the schema (entityKind is handled by its own control, so it is not here)
    const offered = await screen.findByLabelText(/offeredToConsumersInIE/i)
    expect(screen.queryByLabelText(/^entityKind/i)).not.toBeInTheDocument()
    await user.type(screen.getByLabelText(/entity name/i), 'Acme Bank')
    await user.type(screen.getByLabelText(/entity identifier/i), 'acme')
    await user.selectOptions(offered, 'true')
    await user.selectOptions(screen.getByLabelText(/serviceType/i), 'consumer_banking')

    await user.click(screen.getByRole('button', { name: /create and evaluate/i }))

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST' && c.url.includes('/api/v1/entities'))
      expect(post?.body).toMatchObject({
        packKey: 'eaa-accessibility',
        name: 'Acme Bank',
        entityIdentifier: 'acme',
        entityKind: 'service',
        facts: { offeredToConsumersInIE: true, serviceType: 'consumer_banking' },
      })
    })

    // navigated to the matrix
    expect(await screen.findByText(/of 3 controls are required/i)).toBeInTheDocument()
  })

  it('surfaces a field-level error from a 422 response', async () => {
    const user = userEvent.setup()
    mockApi([
      packsStub,
      packDetailStub,
      {
        path: '/api/v1/entities',
        method: 'POST',
        status: 422,
        body: {
          error: {
            code: 'INVALID_FACTS',
            message: 'entity facts are invalid',
            issues: [
              {
                fact: 'offeredToConsumersInIE',
                message: 'fact "offeredToConsumersInIE" is required',
              },
            ],
          },
        },
      },
    ])

    renderRoute('/w/entities/new')
    await user.selectOptions(await screen.findByLabelText(/control pack/i), 'eaa-accessibility')
    await user.type(await screen.findByLabelText(/entity name/i), 'X')
    await user.type(screen.getByLabelText(/entity identifier/i), 'x')
    await user.click(screen.getByRole('button', { name: /create and evaluate/i }))

    expect(
      await screen.findByText(/fact "offeredToConsumersInIE" is required/i),
    ).toBeInTheDocument()
  })
})

function matrixBody(id: string) {
  return {
    entity: {
      id,
      name: 'Acme Bank',
      packKey: 'eaa-accessibility',
      entityKind: 'service',
      entityIdentifier: 'acme',
    },
    evaluation: {
      id: 'ev',
      snapshotKey: 'SNAP',
      evaluatedAt: '2026-08-30T12:00:00.000Z',
      hash: 'sha256:abc',
      version: 1,
    },
    summary: {
      total: 3,
      requiredNow: 2,
      optional: 1,
      conditional: 0,
      notApplicable: 0,
      notYetRequired: 0,
      needsSpecialistReview: 0,
      duplicate: 0,
    },
    rows: [
      {
        control: 'C-1',
        title: 'One',
        family: 'web',
        standardClause: null,
        wcagSc: null,
        accessClassDefault: 'PUBLIC_CANDIDATE',
        applicability: 'REQUIRED_BY_SNAPSHOT',
      },
    ],
  }
}
