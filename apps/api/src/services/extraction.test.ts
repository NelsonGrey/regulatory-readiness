import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { PackRegistry } from '../pack-registry.js'
import { createInMemoryStores, inMemoryUnitOfWork, type InMemoryStores } from '../db/uow.js'
import { EntityService } from './entities.js'
import { ClaimService } from './claims.js'
import { DocumentService } from './documents.js'
import { ExtractionService } from './extraction.js'
import { createLocalObjectStore, type ObjectStore } from '../storage/object-store.js'
import type { AuthContext } from '../auth.js'
import { bankEntityRequest } from '../acceptance/helpers.js'

const PACKS_DIR = fileURLToPath(new URL('../../../../packs', import.meta.url))
const auth: AuthContext = { tenantId: 't-demo', actor: 'manager@acme' }
const CONTROL = 'EAA-EN549-9-2-1-1' // "Web: all functionality is operable by keyboard"

const DOC_TEXT = [
  'Accessibility test report',
  'Keyboard: fully operable by keyboard on all pages',
  '',
].join('\n')

async function setup(): Promise<{
  entities: EntityService
  claims: ClaimService
  docs: DocumentService
  extraction: ExtractionService
  store: ObjectStore
  stores: InMemoryStores
  entityId: string
}> {
  const registry = await PackRegistry.load(PACKS_DIR)
  const stores = createInMemoryStores()
  const uow = inMemoryUnitOfWork(stores)
  const store = createLocalObjectStore()
  const entities = new EntityService(uow, registry)
  const created = await entities.create(auth, bankEntityRequest())
  if (!created.ok) throw new Error('setup failed')
  return {
    entities,
    claims: new ClaimService(uow, registry),
    docs: new DocumentService(uow, store),
    extraction: new ExtractionService(uow, registry, store),
    store,
    stores,
    entityId: created.entity.id,
  }
}

async function uploadDoc(ctx: Awaited<ReturnType<typeof setup>>, text: string): Promise<string> {
  const started = await ctx.docs.initiateUpload(auth, {
    filename: 'report.txt',
    mediaType: 'text/plain',
    sizeBytes: text.length,
    entityId: ctx.entityId,
  })
  if (!started.ok) throw new Error('upload init failed')
  await ctx.store.put!(started.objectKey, Buffer.from(text))
  const fin = await ctx.docs.finalizeUpload(auth, started.documentId)
  if (!fin.ok || fin.status !== 'AVAILABLE') throw new Error('finalize failed')
  return started.documentId
}

describe('ExtractionService', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => {
    ctx = await setup()
  })

  it('runs an extraction and produces PENDING proposals with a source quote', async () => {
    const documentId = await uploadDoc(ctx, DOC_TEXT)
    const run = await ctx.extraction.run(auth, ctx.entityId, documentId)
    expect(run.ok).toBe(true)
    if (!run.ok) return
    expect(run.proposalCount).toBeGreaterThan(0)

    const detail = await ctx.extraction.get(auth, run.runId)
    const forControl = detail?.proposals.find((p) => p.controlKey === CONTROL)
    expect(forControl).toMatchObject({
      status: 'PENDING',
      value: expect.stringContaining('keyboard'),
      quote: expect.stringContaining('Keyboard:'),
    })
    expect(ctx.stores.audit.map((a) => a.action)).toContain('extraction.run')
    expect(ctx.stores.outbox.map((o) => o.topic)).toContain('document.extracted')
  })

  it('accepting a proposal creates a PENDING_REVIEW claim + evidence link and evidences the control', async () => {
    const documentId = await uploadDoc(ctx, DOC_TEXT)
    const run = await ctx.extraction.run(auth, ctx.entityId, documentId)
    if (!run.ok) throw new Error()
    const detail = await ctx.extraction.get(auth, run.runId)
    const proposal = detail!.proposals.find((p) => p.controlKey === CONTROL)!

    const accepted = await ctx.extraction.acceptProposal(auth, proposal.id)
    expect(accepted).toMatchObject({ ok: true })
    if (!accepted.ok) return

    const claim = ctx.stores.claims.find((c) => c.id === accepted.claimId)
    expect(claim).toMatchObject({ origin: 'EXTRACTION_ACCEPTED', status: 'PENDING_REVIEW' })

    // approve it — it already carries the extracted evidence → EVIDENCED
    await ctx.claims.decide(auth, accepted.claimId, { decision: 'APPROVED' })

    const matrix = await ctx.entities.matrix(auth, ctx.entityId)
    const row = matrix?.rows.find((r) => r.control === CONTROL)
    expect(row?.readiness).toBe('EVIDENCED')
    expect(row?.evidenceCount).toBe(1)

    // a second accept on the same proposal is rejected
    expect(await ctx.extraction.acceptProposal(auth, proposal.id)).toMatchObject({
      ok: false,
      code: 'NOT_PENDING',
    })
  })

  it('rejecting a proposal requires a reason', async () => {
    const documentId = await uploadDoc(ctx, DOC_TEXT)
    const run = await ctx.extraction.run(auth, ctx.entityId, documentId)
    if (!run.ok) throw new Error()
    const proposal = (await ctx.extraction.get(auth, run.runId))!.proposals[0]!

    expect(await ctx.extraction.rejectProposal(auth, proposal.id, '  ')).toMatchObject({
      ok: false,
      code: 'REASON_REQUIRED',
    })
    expect(await ctx.extraction.rejectProposal(auth, proposal.id, 'wrong value')).toMatchObject({
      ok: true,
    })
  })

  it('will not run against a document that is not linked to the entity', async () => {
    // upload without an entity association
    const started = await ctx.docs.initiateUpload(auth, {
      filename: 'loose.txt',
      mediaType: 'text/plain',
      sizeBytes: 10,
    })
    if (!started.ok) throw new Error()
    await ctx.store.put!(started.objectKey, Buffer.from('Keyboard: yes'))
    await ctx.docs.finalizeUpload(auth, started.documentId)

    expect(await ctx.extraction.run(auth, ctx.entityId, started.documentId)).toMatchObject({
      ok: false,
      code: 'DOCUMENT_NOT_LINKED',
    })
  })
})
