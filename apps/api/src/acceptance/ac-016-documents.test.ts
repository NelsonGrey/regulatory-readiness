/**
 * User-acceptance scenario for AC-016 — document intake.
 * An operator uploads a file; it is scanned before it becomes available; a
 * quarantined/malware object is never downloadable; the original is stored
 * unchanged with a recorded SHA-256.
 */
import { describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createInMemoryStores, inMemoryUnitOfWork } from '../db/uow.js'
import { bankEntityRequest, type InjectResponse, buildTestApp } from './helpers.js'

const headers = { 'x-tenant-id': 't-demo', 'x-actor': 'manager@acme' }
const bytesHeaders = { ...headers, 'content-type': 'application/octet-stream' }

describe('AC-016 — document intake', () => {
  const withApp = async (fn: (app: FastifyInstance) => Promise<void>): Promise<void> => {
    const app = buildTestApp({
      logLevel: 'error',
      unitOfWork: inMemoryUnitOfWork(createInMemoryStores()),
    })
    try {
      await fn(app)
    } finally {
      await app.close()
    }
  }

  const json = (r: InjectResponse) => r.json() as Record<string, unknown>

  async function createEntity(app: FastifyInstance): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/entities',
      headers,
      payload: bankEntityRequest(),
    })
    return (res.json() as { entity: { id: string } }).entity.id
  }

  async function uploadFile(
    app: FastifyInstance,
    entityId: string,
    body: string,
  ): Promise<{ documentId: string; finalizeStatus: number; final: Record<string, unknown> }> {
    const started = await app.inject({
      method: 'POST',
      url: '/api/v1/documents',
      headers,
      payload: {
        filename: 'evidence.pdf',
        mediaType: 'application/pdf',
        sizeBytes: body.length,
        entityId,
      },
    })
    expect(started.statusCode).toBe(201)
    const { documentId, uploadUrl } = json(started) as { documentId: string; uploadUrl: string }

    const put = await app.inject({
      method: 'PUT',
      url: uploadUrl,
      headers: bytesHeaders,
      payload: Buffer.from(body),
    })
    expect(put.statusCode).toBe(204)

    const fin = await app.inject({
      method: 'POST',
      url: `/api/v1/documents/${documentId}/finalize`,
      headers,
    })
    return { documentId, finalizeStatus: fin.statusCode, final: json(fin) }
  }

  it('uploads → scans → becomes available → downloads the stored bytes', async () => {
    await withApp(async (app) => {
      const entityId = await createEntity(app)
      const { documentId, finalizeStatus, final } = await uploadFile(
        app,
        entityId,
        '%PDF-1.4 hello',
      )
      expect(finalizeStatus).toBe(200)
      expect(final.status).toBe('AVAILABLE')
      expect(final.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/)

      const list = await app.inject({
        method: 'GET',
        url: `/api/v1/documents?entityId=${entityId}`,
        headers,
      })
      expect((list.json() as { documents: unknown[] }).documents).toHaveLength(1)

      const dl = await app.inject({
        method: 'GET',
        url: `/api/v1/documents/${documentId}/download`,
        headers,
      })
      expect(dl.statusCode).toBe(200)
      const url = (dl.json() as { url: string }).url

      const content = await app.inject({ method: 'GET', url, headers })
      expect(content.statusCode).toBe(200)
      expect(content.body).toBe('%PDF-1.4 hello')
    })
  })

  it('quarantines a malware upload — never AVAILABLE, never downloadable', async () => {
    await withApp(async (app) => {
      const entityId = await createEntity(app)
      const { documentId, final } = await uploadFile(
        app,
        entityId,
        'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
      )
      expect(final.status).toBe('REJECTED_MALWARE')

      const dl = await app.inject({
        method: 'GET',
        url: `/api/v1/documents/${documentId}/download`,
        headers,
      })
      expect(dl.statusCode).toBe(409)
    })
  })

  it('rejects an unsupported media type at initiation', async () => {
    await withApp(async (app) => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/documents',
        headers,
        payload: { filename: 'x.exe', mediaType: 'application/x-msdownload', sizeBytes: 10 },
      })
      expect(res.statusCode).toBe(422)
      expect(json(res).error).toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' })
    })
  })
})
