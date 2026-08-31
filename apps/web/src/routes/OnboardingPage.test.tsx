import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderRoute } from '../test/harness.js'

const unread = { path: '/api/v1/notifications/unread-count', method: 'GET', body: { count: 0 } }
const workspaces = {
  path: '/api/v1/workspaces',
  method: 'GET',
  body: {
    workspaces: [{ id: 'demo-tenant', name: 'Demo', slug: 'demo', plan: 'trial', role: 'owner' }],
  },
}

const packs = {
  path: '/api/v1/packs',
  method: 'GET',
  body: {
    packs: [
      {
        packKey: 'eaa-accessibility',
        title: 'EU Accessibility Act',
        jurisdiction: 'IE',
        snapshotKey: 'SNAP',
        status: 'draft',
        valid: true,
      },
    ],
  },
}

const packDetail = {
  path: '/api/v1/packs/eaa-accessibility',
  method: 'GET',
  body: {
    packKey: 'eaa-accessibility',
    title: 'EU Accessibility Act',
    jurisdiction: 'IE',
    snapshotKey: 'SNAP',
    status: 'draft',
    valid: true,
    controlCount: 2,
    controlFamilies: [],
    entityFacts: [{ name: 'offeredToConsumersInIE', type: 'boolean', required: true }],
    copy: { limitationStatement: 'x', forbiddenPhrases: [] },
  },
}

const matrix = {
  path: '/api/v1/entities/ent_1/matrix',
  method: 'GET',
  body: {
    entity: {
      id: 'ent_1',
      name: 'Acme App',
      packKey: 'eaa-accessibility',
      entityKind: 'service',
      entityIdentifier: 'acme',
    },
    evaluation: { id: 'ev', snapshotKey: 'SNAP', evaluatedAt: '', hash: 'sha256:x', version: 1 },
    summary: {
      total: 1,
      requiredNow: 1,
      optional: 0,
      conditional: 0,
      notApplicable: 0,
      notYetRequired: 0,
      needsSpecialistReview: 0,
      duplicate: 0,
    },
    entityStatus: 'REVIEW_NEEDED',
    readinessCounts: {},
    rows: [
      {
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
      },
    ],
  },
}

describe('OnboardingPage', () => {
  it('walks pick-regulation → add-entity → send-request', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi([
      unread,
      workspaces,
      packs,
      packDetail,
      matrix,
      {
        path: '/api/v1/entities',
        method: 'POST',
        status: 201,
        body: {
          entity: {
            id: 'ent_1',
            name: 'Acme App',
            packKey: 'eaa-accessibility',
            entityKind: 'service',
            createdAt: '',
            createdBy: 'operator@local',
          },
          evaluation: { id: 'ev', snapshotKey: 'SNAP', hash: 'sha256:x', version: 1 },
        },
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
          token: 'tok_onboard',
          tokenPrefix: 'tok_onbo',
          expiresAt: '2026-09-20T00:00:00.000Z',
          contributorPath: '/contributor/v1/requests/tok_onboard',
        },
      },
    ])

    renderRoute('/w/onboarding')

    // step 1
    await user.click(await screen.findByRole('radio', { name: /EU Accessibility Act/i }))
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // step 2
    await user.type(await screen.findByLabelText(/^name/i), 'Acme App')
    await user.type(screen.getByLabelText(/^identifier/i), 'acme')
    await user.selectOptions(await screen.findByLabelText(/offeredToConsumersInIE/i), 'true')
    await user.click(screen.getByRole('button', { name: /create & continue/i }))

    // step 3
    await user.click(await screen.findByRole('checkbox', { name: /EAA-1/i }))
    await user.click(screen.getByRole('button', { name: /create request \(1\)/i }))

    // done
    expect(await screen.findByTestId('onboarding-done')).toHaveTextContent(
      /contribute\/tok_onboard/,
    )
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/entities'))).toBe(true)
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/ent_1/requests'))).toBe(true)
  })
})
