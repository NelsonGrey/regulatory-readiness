import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { AssociateDocumentRequest, InitiateUploadRequest } from '@rre/contracts'
import { authFromRequest } from '../auth.js'
import type { DocumentService } from '../services/documents.js'
import type { ObjectStore } from '../storage/object-store.js'

interface DocumentRoutesOptions extends FastifyPluginOptions {
  documents: DocumentService
  store: ObjectStore
}

const NO_TENANT = { error: { code: 'NO_TENANT', message: 'x-tenant-id header is required' } }
const invalidBody = (issues: unknown) => ({
  error: { code: 'INVALID_BODY', message: 'invalid request body', details: issues },
})

/** Document intake + evidence store (engine TRD §10). */
export async function registerDocumentRoutes(
  app: FastifyInstance,
  opts: DocumentRoutesOptions,
): Promise<void> {
  app.post('/documents', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const parsed = InitiateUploadRequest.safeParse(req.body)
    if (!parsed.success) return reply.code(422).send(invalidBody(parsed.error.issues))
    const result = await opts.documents.initiateUpload(auth, parsed.data)
    if (!result.ok) {
      return reply.code(422).send({ error: { code: result.code, message: result.message } })
    }
    return reply.code(201).send({
      documentId: result.documentId,
      uploadUrl: result.upload.url,
      uploadMethod: result.upload.method,
      objectKey: result.objectKey,
    })
  })

  app.post('/documents/:id/finalize', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { id } = req.params as { id: string }
    const result = await opts.documents.finalizeUpload(auth, id)
    if (!result.ok) {
      const code =
        result.code === 'NOT_FOUND' ? 404 : result.code === 'ALREADY_FINALIZED' ? 409 : 422
      return reply.code(code).send({ error: { code: result.code, message: result.message } })
    }
    return { status: result.status, contentHash: result.contentHash, scanNote: result.scanNote }
  })

  app.get('/documents', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { entityId } = req.query as { entityId?: string }
    return { documents: await opts.documents.list(auth, { entityId }) }
  })

  app.get('/documents/:id', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { id } = req.params as { id: string }
    const detail = await opts.documents.get(auth, id)
    if (!detail) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'document not found' } })
    }
    return detail
  })

  app.get('/documents/:id/download', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const { id } = req.params as { id: string }
    const result = await opts.documents.downloadUrl(auth, id)
    if (!result.ok) {
      const code = result.code === 'NOT_FOUND' ? 404 : 409
      return reply.code(code).send({ error: { code: result.code, message: result.message } })
    }
    return { url: result.url }
  })

  app.post('/documents/:id/associations', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const parsed = AssociateDocumentRequest.safeParse(req.body)
    if (!parsed.success) return reply.code(422).send(invalidBody(parsed.error.issues))
    const { id } = req.params as { id: string }
    const result = await opts.documents.associate(auth, id, parsed.data)
    if (!result.ok) {
      return reply.code(404).send({ error: { code: result.code, message: result.message } })
    }
    return reply.code(201).send({ association: result.association })
  })

  // Local object store only: the API both issues the upload URL and stores/serves
  // the bytes. With S3 the client PUTs/GETs the bucket directly via presigned URLs.
  if (opts.store.kind === 'local' && opts.store.put) {
    const put = opts.store.put.bind(opts.store)
    app.put('/documents/content/:key', async (req, reply) => {
      const auth = authFromRequest(req)
      if (!auth) return reply.code(401).send(NO_TENANT)
      const { key } = req.params as { key: string }
      const decoded = decodeURIComponent(key)
      if (!decoded.startsWith(`quarantine/${auth.tenantId}/`)) {
        return reply
          .code(403)
          .send({ error: { code: 'FORBIDDEN', message: 'not your upload slot' } })
      }
      const body = req.body
      if (!Buffer.isBuffer(body)) {
        return reply
          .code(415)
          .send({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'send raw bytes' } })
      }
      await put(decoded, body)
      return reply.code(204).send()
    })

    app.get('/documents/content/:key', async (req, reply) => {
      const auth = authFromRequest(req)
      if (!auth) return reply.code(401).send(NO_TENANT)
      const decoded = decodeURIComponent((req.params as { key: string }).key)
      // Only promoted (post-scan) objects are served; quarantine is never downloadable.
      if (!decoded.startsWith(`originals/${auth.tenantId}/`)) {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'no such object' } })
      }
      try {
        const bytes = await opts.store.getBytes(decoded)
        return reply.header('content-type', 'application/octet-stream').send(bytes)
      } catch {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'no such object' } })
      }
    })
  }
}
