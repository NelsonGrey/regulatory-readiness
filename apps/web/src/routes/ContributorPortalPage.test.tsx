import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderRoute } from '../test/harness.js'

const view = {
  requestingOrganization: 'Acme Storefront',
  entityName: 'Acme Storefront',
  dueAt: null,
  status: 'SENT',
  items: [
    {
      requestItemId: 'rqi_1',
      controlKey: 'EAA-1',
      title: 'Text alternatives',
      instructions: 'List where alt text is applied',
      required: true,
    },
    {
      requestItemId: 'rqi_2',
      controlKey: 'EAA-2',
      title: 'Captions',
      instructions: null,
      required: false,
    },
  ],
}

describe('ContributorPortalPage', () => {
  it('shows only the requested controls and submits answers without an account', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi([
      { path: '/contributor/v1/requests/tok_1', method: 'GET', body: view },
      {
        path: '/contributor/v1/requests/tok_1/submit',
        method: 'POST',
        status: 201,
        body: {
          receiptId: 'rcpt_abc123',
          submittedAt: '2026-08-31T09:00:00.000Z',
          itemCount: 2,
          version: 1,
          note: 'Received for review; not yet accepted or approved.',
        },
      },
    ])

    renderRoute('/contribute/tok_1')

    expect(await screen.findByText(/information request from acme storefront/i)).toBeInTheDocument()
    expect(screen.getByText(/text alternatives/i)).toBeInTheDocument()
    expect(screen.getByText(/captions/i)).toBeInTheDocument()

    await user.type(
      screen.getByLabelText('Value', { selector: '#value-rqi_1' }),
      'alt text on all images',
    )
    // Second item: mark as unavailable.
    await user.selectOptions(
      screen.getByLabelText('Response', { selector: '#state-rqi_2' }),
      'UNAVAILABLE',
    )
    await user.type(screen.getByLabelText(/your name or email/i), 'sam@supplier.example')

    await user.click(screen.getByRole('button', { name: /send answers/i }))

    await waitFor(() => {
      const post = calls.find((c) => c.method === 'POST')
      expect(post?.body).toEqual({
        submitterIdentity: 'sam@supplier.example',
        items: [
          {
            requestItemId: 'rqi_1',
            availabilityState: 'VALUE_SUPPLIED',
            value: 'alt text on all images',
          },
          { requestItemId: 'rqi_2', availabilityState: 'UNAVAILABLE' },
        ],
      })
    })

    expect(await screen.findByText(/your answers were received/i)).toBeInTheDocument()
    expect(screen.getByText('rcpt_abc123')).toBeInTheDocument()
    expect(screen.getByText(/not yet accepted or approved/i)).toBeInTheDocument()
  })

  it('shows a generic message for an invalid or expired link', async () => {
    mockApi([
      {
        path: '/contributor/v1/requests/tok_bad',
        method: 'GET',
        status: 404,
        body: {
          error: { code: 'INVALID_LINK', message: 'this link is invalid, expired, or revoked' },
        },
      },
    ])

    renderRoute('/contribute/tok_bad')
    expect(await screen.findByText(/this link cannot be opened/i)).toBeInTheDocument()
  })

  it('surfaces an incomplete-submission error from the server', async () => {
    const user = userEvent.setup()
    mockApi([
      { path: '/contributor/v1/requests/tok_1', method: 'GET', body: view },
      {
        path: '/contributor/v1/requests/tok_1/submit',
        method: 'POST',
        status: 422,
        body: { error: { code: 'INCOMPLETE', message: 'required items unanswered: rqi_1' } },
      },
    ])

    renderRoute('/contribute/tok_1')
    await screen.findByText(/information request from/i)

    await user.click(screen.getByRole('button', { name: /send answers/i }))

    expect(await screen.findByText(/required items unanswered/i)).toBeInTheDocument()
  })
})
