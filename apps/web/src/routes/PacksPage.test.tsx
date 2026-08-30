import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { mockApi, renderRoute } from '../test/harness.js'

describe('PacksPage', () => {
  it('lists installed control packs from GET /api/v1/packs', async () => {
    mockApi([
      {
        path: '/api/v1/packs',
        body: {
          packs: [
            {
              packKey: 'eaa-accessibility',
              title: 'EU Accessibility Act (Ireland)',
              jurisdiction: 'IE',
              status: 'draft',
              snapshotKey: 'EAA-IE-EN549-V3.2.1-DRAFT',
              valid: true,
            },
          ],
        },
      },
    ])

    renderRoute('/')

    expect(await screen.findByRole('heading', { name: /control packs/i })).toBeInTheDocument()
    expect(await screen.findByText('eaa-accessibility')).toBeInTheDocument()
    expect(screen.getByText('EU Accessibility Act (Ireland)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /create a regulated entity/i })).toHaveAttribute(
      'href',
      '/w/entities/new',
    )
  })

  it('shows an error when the API is unreachable', async () => {
    mockApi([{ path: '/api/v1/packs', status: 500, body: { error: { message: 'boom' } } }])
    renderRoute('/')
    expect(await screen.findByText(/could not load control packs/i)).toBeInTheDocument()
  })
})
