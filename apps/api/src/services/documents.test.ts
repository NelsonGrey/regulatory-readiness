import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { PackRegistry } from '../pack-registry.js'
import { createInMemoryStores, inMemoryUnitOfWork, type InMemoryStores } from '../db/uow.js'
import { EntityService } from './entities.js'
import { DocumentService } from './documents.js'
import { createLocalObjectStore, type ObjectStore } from '../storage/object-store.js'
import type { AuthContext } from '../auth.js'
import { bankEntityRequest } from '../acceptance/helpers.js'

const PACKS_DIR = fileURLToPath(new URL('../../../../packs', import.meta.url))
const auth: AuthContext = { tenantId: 't-demo', actor: 'manager@acme' }
const PDF = 'application/pdf'

async function setup(): Promise<{
  docs: DocumentService
  store: ObjectStore
  stores: InMemoryStores
  entityId: string
}> {
  const registry = await PackRegistry.load(PACKS_DIR)
  const stores = createInMemoryStores()
  const uow = inMemoryUnitOfWork(stores)
  const store = createLocalObjectStore()
  const created = await new EntityService(uow, registry).create(auth, bankEntityRequest())
  if (!created.ok) throw new Error('setup failed')
  return {
    docs: new DocumentService(uow, store, { maxBytes: 1024 }),
    store,
    stores,
    entityId: created.entity.id,
  }
}

async function putUpload(store: ObjectStore, key: string, bytes: Buffer): Promise<void> {
  if (!store.put) throw new Error('local store expected')
  await store.put(key, bytes)
}

describe('DocumentService', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => {
    ctx = await setup()
  })

  it('rejects an unsupported media type and an over-size declaration up front', async () => {
    expect(
      await ctx.docs.initiateUpload(auth, {
        filename: 'x.exe',
        mediaType: 'application/x-msdownload',
        sizeBytes: 10,
      }),
    ).toMatchObject({ ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' })
    expect(
      await ctx.docs.initiateUpload(auth, {
        filename: 'big.pdf',
        mediaType: PDF,
        sizeBytes: 99999,
      }),
    ).toMatchObject({ ok: false, code: 'TOO_LARGE' })
  })

  it('takes an upload from UPLOADING through scan to AVAILABLE, hashed and downloadable', async () => {
    const started = await ctx.docs.initiateUpload(auth, {
      filename: 'audit.pdf',
      mediaType: PDF,
      sizeBytes: 12,
      entityId: ctx.entityId,
    })
    if (!started.ok) throw new Error()

    await putUpload(ctx.store, started.objectKey, Buffer.from('%PDF-1.4 abc'))
    const final = await ctx.docs.finalizeUpload(auth, started.documentId)
    expect(final).toMatchObject({ ok: true, status: 'AVAILABLE' })
    if (!final.ok) return
    expect(final.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/)

    const detail = await ctx.docs.get(auth, started.documentId)
    expect(detail?.document.status).toBe('AVAILABLE')
    expect(detail?.document.objectKey).toBe(`originals/t-demo/${started.documentId}`)
    expect(detail?.associations.map((a) => a.targetId)).toEqual([ctx.entityId])

    const dl = await ctx.docs.downloadUrl(auth, started.documentId)
    expect(dl).toMatchObject({ ok: true })

    // listed under the entity
    const list = await ctx.docs.list(auth, { entityId: ctx.entityId })
    expect(list.map((d) => d.id)).toEqual([started.documentId])

    expect(ctx.stores.audit.map((a) => a.action)).toContain('document.available')
    expect(ctx.stores.outbox.map((o) => o.topic)).toContain('document.available')
  })

  it('quarantines a malware upload and refuses to hand out a download URL', async () => {
    const started = await ctx.docs.initiateUpload(auth, {
      filename: 'x.pdf',
      mediaType: PDF,
      sizeBytes: 68,
    })
    if (!started.ok) throw new Error()
    await putUpload(
      ctx.store,
      started.objectKey,
      Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'),
    )
    const final = await ctx.docs.finalizeUpload(auth, started.documentId)
    expect(final).toMatchObject({ ok: true, status: 'REJECTED_MALWARE' })

    expect(await ctx.docs.downloadUrl(auth, started.documentId)).toMatchObject({
      ok: false,
      code: 'NOT_AVAILABLE',
    })
    expect(ctx.stores.outbox.map((o) => o.topic)).toContain('document.rejected')
  })

  it('errors when finalizing with no uploaded object, and when finalizing twice', async () => {
    const started = await ctx.docs.initiateUpload(auth, {
      filename: 'x.pdf',
      mediaType: PDF,
      sizeBytes: 3,
    })
    if (!started.ok) throw new Error()

    expect(await ctx.docs.finalizeUpload(auth, started.documentId)).toMatchObject({
      ok: false,
      code: 'NO_UPLOAD',
    })

    await putUpload(ctx.store, started.objectKey, Buffer.from('abc'))
    await ctx.docs.finalizeUpload(auth, started.documentId)
    expect(await ctx.docs.finalizeUpload(auth, started.documentId)).toMatchObject({
      ok: false,
      code: 'ALREADY_FINALIZED',
    })
  })

  it('associates a document with a claim after the fact', async () => {
    const started = await ctx.docs.initiateUpload(auth, {
      filename: 'x.pdf',
      mediaType: PDF,
      sizeBytes: 3,
    })
    if (!started.ok) throw new Error()
    const res = await ctx.docs.associate(auth, started.documentId, {
      targetType: 'claim',
      targetId: 'clm_1',
    })
    expect(res).toMatchObject({ ok: true })
    expect(
      await ctx.docs.associate(auth, 'doc_missing', { targetType: 'claim', targetId: 'x' }),
    ).toMatchObject({ ok: false, code: 'NOT_FOUND' })
  })
})
