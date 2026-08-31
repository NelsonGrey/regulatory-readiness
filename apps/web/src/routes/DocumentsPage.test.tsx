import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi, renderRoute } from '../test/harness.js'

const doc = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'doc_1',
  filename: 'audit.pdf',
  mediaType: 'application/pdf',
  sizeBytes: 2048,
  contentHash: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  accessClass: 'INTERNAL_CONFIDENTIAL',
  status: 'AVAILABLE',
  scanNote: null,
  ingestedBy: 'operator@local',
  createdAt: '2026-08-31T12:00:00.000Z',
  availableAt: '2026-08-31T12:00:05.000Z',
  ...over,
})

describe('DocumentsPage', () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:stub')
    global.URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  it('uploads a file end to end and lists it', async () => {
    const user = userEvent.setup()
    let uploaded = false
    const { calls } = mockApi([
      { path: '/api/v1/notifications/unread-count', method: 'GET', body: { count: 0 } },
      {
        path: '/api/v1/documents',
        method: 'GET',
        get body() {
          return { documents: uploaded ? [doc()] : [] }
        },
      },
      {
        path: '/api/v1/documents',
        method: 'POST',
        status: 201,
        body: {
          documentId: 'doc_1',
          uploadUrl: '/api/v1/documents/content/quarantine%2Fdemo-tenant%2Fdoc_1',
          uploadMethod: 'PUT',
          objectKey: 'quarantine/demo-tenant/doc_1',
        },
      },
      {
        path: '/api/v1/documents/content/quarantine%2Fdemo-tenant%2Fdoc_1',
        method: 'PUT',
        status: 204,
        body: null,
      },
      {
        path: '/api/v1/documents/doc_1/finalize',
        method: 'POST',
        get body() {
          uploaded = true
          return { status: 'AVAILABLE', contentHash: doc().contentHash, scanNote: null }
        },
      },
    ])

    renderRoute('/w/entities/ent_1/documents')
    expect(await screen.findByText(/no documents yet/i)).toBeInTheDocument()

    const file = new File(['%PDF-1.4 data'], 'audit.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText(/choose a file/i), file)

    await waitFor(() => {
      expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/documents'))).toBe(true)
      expect(calls.some((c) => c.method === 'PUT' && c.url.includes('/documents/content/'))).toBe(
        true,
      )
      expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/finalize'))).toBe(true)
    })
    expect(await screen.findByText('audit.pdf')).toBeInTheDocument()
    expect(screen.getByText('Available')).toBeInTheDocument()
  })

  it('surfaces a rejected upload', async () => {
    const user = userEvent.setup()
    mockApi([
      { path: '/api/v1/notifications/unread-count', method: 'GET', body: { count: 0 } },
      { path: '/api/v1/documents', method: 'GET', body: { documents: [] } },
      {
        path: '/api/v1/documents',
        method: 'POST',
        status: 201,
        body: {
          documentId: 'doc_1',
          uploadUrl: '/api/v1/documents/content/quarantine%2Fdemo-tenant%2Fdoc_1',
          uploadMethod: 'PUT',
          objectKey: 'quarantine/demo-tenant/doc_1',
        },
      },
      {
        path: '/api/v1/documents/content/quarantine%2Fdemo-tenant%2Fdoc_1',
        method: 'PUT',
        status: 204,
        body: null,
      },
      {
        path: '/api/v1/documents/doc_1/finalize',
        method: 'POST',
        body: {
          status: 'REJECTED_MALWARE',
          contentHash: null,
          scanNote: 'a test signature matched',
        },
      },
    ])

    renderRoute('/w/entities/ent_1/documents')
    await screen.findByText(/no documents yet/i)

    const file = new File(['bad'], 'x.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText(/choose a file/i), file)

    expect(await screen.findByText(/upload rejected/i)).toBeInTheDocument()
    expect(screen.getByText(/a test signature matched/i)).toBeInTheDocument()
  })

  it('downloads an available document', async () => {
    const user = userEvent.setup()
    const { calls } = mockApi([
      { path: '/api/v1/notifications/unread-count', method: 'GET', body: { count: 0 } },
      { path: '/api/v1/documents', method: 'GET', body: { documents: [doc()] } },
      {
        path: '/api/v1/documents/doc_1/download',
        method: 'GET',
        body: { url: '/api/v1/documents/content/originals%2Fdemo-tenant%2Fdoc_1' },
      },
      {
        path: '/api/v1/documents/content/originals%2Fdemo-tenant%2Fdoc_1',
        method: 'GET',
        body: '%PDF-1.4 data',
      },
    ])

    renderRoute('/w/entities/ent_1/documents')
    await screen.findByText('audit.pdf')

    await user.click(screen.getByRole('button', { name: /download/i }))

    await waitFor(() => {
      expect(calls.some((c) => c.url.endsWith('/download'))).toBe(true)
      expect(calls.some((c) => c.url.includes('/content/originals'))).toBe(true)
    })
    expect(global.URL.createObjectURL).toHaveBeenCalled()
  })
})
