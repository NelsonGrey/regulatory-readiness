import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { scanMarketingCopy } from '@rre/copy-guard'
import { PackRegistry } from '../pack-registry.js'
import { createInMemoryStores, inMemoryUnitOfWork, type InMemoryStores } from '../db/uow.js'
import { EntityService } from './entities.js'
import { ClaimService } from './claims.js'
import { SnapshotService } from './snapshots.js'
import type { AuthContext } from '../auth.js'
import type { DocumentRecord } from './documents.js'
import { bankEntityRequest } from '../acceptance/helpers.js'

const PACKS_DIR = fileURLToPath(new URL('../../../../packs', import.meta.url))
const auth: AuthContext = { tenantId: 't-demo', actor: 'manager@acme' }
const CONTROL = 'EAA-EN549-9-1-1-1'

const availableDoc = (tenantId: string, id: string): DocumentRecord => ({
  id,
  tenantId,
  filename: `${id}.pdf`,
  mediaType: 'application/pdf',
  sizeBytes: 10,
  uploadKey: `quarantine/${tenantId}/${id}`,
  objectKey: `originals/${tenantId}/${id}`,
  contentHash: 'sha256:beef',
  accessClass: 'INTERNAL_CONFIDENTIAL',
  status: 'AVAILABLE',
  scanNote: null,
  ingestedBy: 'tester',
  createdAt: '2026-08-31T00:00:00.000Z',
  availableAt: '2026-08-31T00:00:01.000Z',
})

async function setup(): Promise<{
  claims: ClaimService
  snapshots: SnapshotService
  stores: InMemoryStores
  entityId: string
}> {
  const registry = await PackRegistry.load(PACKS_DIR)
  const stores = createInMemoryStores()
  const uow = inMemoryUnitOfWork(stores)
  const entities = new EntityService(uow, registry)
  const created = await entities.create(auth, bankEntityRequest())
  if (!created.ok) throw new Error('setup failed')
  return {
    claims: new ClaimService(uow, registry),
    snapshots: new SnapshotService(uow, registry),
    stores,
    entityId: created.entity.id,
  }
}

describe('SnapshotService', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => {
    ctx = await setup()
  })

  it('freezes the current readiness, hashes it, audits and notifies', async () => {
    const res = await ctx.snapshots.create(auth, ctx.entityId)
    expect(res.ok).toBe(true)
    if (!res.ok) return

    expect(res.snapshot.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(res.snapshot.document.pack.snapshotKey).toBe(res.snapshot.snapshotKey)
    expect(ctx.stores.audit.map((a) => a.action)).toContain('readiness_snapshot.created')
    expect(ctx.stores.outbox.map((o) => o.topic)).toContain('entity.readiness_snapshot_created')

    const listed = await ctx.snapshots.list(auth, ctx.entityId)
    expect(listed).toHaveLength(1)
    expect(listed[0]).not.toHaveProperty('document')
  })

  it('is immutable — a later approval does not change an existing snapshot', async () => {
    const before = await ctx.snapshots.create(auth, ctx.entityId)
    if (!before.ok) throw new Error()
    const exceptionsBefore = before.snapshot.document.exceptions.length

    const asserted = await ctx.claims.assert(auth, ctx.entityId, CONTROL, { value: 'alt text' })
    if (!asserted.ok) throw new Error()
    await ctx.claims.decide(auth, asserted.claim.id, { decision: 'APPROVED' })
    ctx.stores.documents.push(availableDoc(auth.tenantId, 'doc_s1'))
    await ctx.claims.linkEvidence(auth, asserted.claim.id, { documentId: 'doc_s1' })

    // the stored snapshot is unchanged
    const reread = await ctx.snapshots.get(auth, before.snapshot.id)
    expect(reread?.contentHash).toBe(before.snapshot.contentHash)
    expect(reread?.document.exceptions).toHaveLength(exceptionsBefore)

    // a new snapshot reflects the approval + evidence — CONTROL is no longer an exception
    const after = await ctx.snapshots.create(auth, ctx.entityId)
    if (!after.ok) throw new Error()
    expect(after.snapshot.contentHash).not.toBe(before.snapshot.contentHash)
    expect(after.snapshot.document.exceptions.some((e) => e.control === CONTROL)).toBe(false)
  })

  it('the frozen document and its CSV contain no forbidden compliance language', async () => {
    const asserted = await ctx.claims.assert(auth, ctx.entityId, CONTROL, { value: 'alt text' })
    if (!asserted.ok) throw new Error()
    await ctx.claims.decide(auth, asserted.claim.id, { decision: 'APPROVED' })

    const res = await ctx.snapshots.create(auth, ctx.entityId)
    if (!res.ok) throw new Error()
    expect(scanMarketingCopy(JSON.stringify(res.snapshot.document))).toEqual([])

    const csv = await ctx.snapshots.exportCsv(auth, res.snapshot.id)
    expect(csv).not.toBeNull()
    expect(scanMarketingCopy(csv as string)).toEqual([])
  })

  it('404s for an entity that does not exist', async () => {
    expect(await ctx.snapshots.create(auth, 'ent_nope')).toMatchObject({
      ok: false,
      code: 'ENTITY_NOT_FOUND',
    })
  })
})
