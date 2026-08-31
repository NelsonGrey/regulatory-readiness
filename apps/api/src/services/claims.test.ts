import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { PackRegistry } from '../pack-registry.js'
import { createInMemoryStores, inMemoryUnitOfWork, type InMemoryStores } from '../db/uow.js'
import { EntityService } from './entities.js'
import { ClaimService } from './claims.js'
import type { AuthContext } from '../auth.js'
import { bankEntityRequest } from '../acceptance/helpers.js'

const PACKS_DIR = fileURLToPath(new URL('../../../../packs', import.meta.url))
const auth: AuthContext = { tenantId: 't-demo', actor: 'approver@acme' }
const CONTROL = 'EAA-EN549-9-1-1-1' // a required web control for the bank fixture

async function setup(): Promise<{
  entities: EntityService
  claims: ClaimService
  stores: InMemoryStores
  entityId: string
}> {
  const registry = await PackRegistry.load(PACKS_DIR)
  const stores = createInMemoryStores()
  const uow = inMemoryUnitOfWork(stores)
  const entities = new EntityService(uow, registry)
  const claims = new ClaimService(uow, registry)
  const created = await entities.create(auth, bankEntityRequest())
  if (!created.ok) throw new Error('setup: entity creation failed')
  return { entities, claims, stores, entityId: created.entity.id }
}

describe('ClaimService', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => {
    ctx = await setup()
  })

  it('asserts a claim as PENDING_REVIEW and moves the control to that readiness', async () => {
    const res = await ctx.claims.assert(auth, ctx.entityId, CONTROL, { value: '48 V' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.claim).toMatchObject({
      status: 'PENDING_REVIEW',
      revision: 1,
      origin: 'INTERNAL_ASSERTION',
    })
    expect(ctx.stores.audit.at(-1)).toMatchObject({
      action: 'claim.asserted',
      targetId: res.claim.id,
    })

    const matrix = await ctx.entities.matrix(auth, ctx.entityId)
    const row = matrix?.rows.find((r) => r.control === CONTROL)
    expect(row?.readiness).toBe('PENDING_REVIEW')
    expect(row?.pendingClaims).toBe(1)
  })

  it('approving a claim with no document makes the control SELF_ATTESTED', async () => {
    const asserted = await ctx.claims.assert(auth, ctx.entityId, CONTROL, { value: 'yes' })
    if (!asserted.ok) throw new Error('assert failed')

    const decided = await ctx.claims.decide(auth, asserted.claim.id, { decision: 'APPROVED' })
    expect(decided.ok).toBe(true)
    if (!decided.ok) return
    expect(decided.claim.status).toBe('APPROVED')
    expect(ctx.stores.decisions.at(-1)).toMatchObject({
      decision: 'APPROVED',
      claimId: asserted.claim.id,
    })

    const matrix = await ctx.entities.matrix(auth, ctx.entityId)
    const row = matrix?.rows.find((r) => r.control === CONTROL)
    expect(row?.readiness).toBe('SELF_ATTESTED')
    expect(row?.approvedValue).toBe('yes')
  })

  it('linking a supporting document moves an approved claim to EVIDENCED', async () => {
    const asserted = await ctx.claims.assert(auth, ctx.entityId, CONTROL, { value: 'yes' })
    if (!asserted.ok) throw new Error()
    await ctx.claims.decide(auth, asserted.claim.id, { decision: 'APPROVED' })

    ctx.stores.documents.push({
      id: 'doc_1',
      tenantId: auth.tenantId,
      filename: 'audit.pdf',
      mediaType: 'application/pdf',
      sizeBytes: 10,
      uploadKey: 'quarantine/t-demo/doc_1',
      objectKey: 'originals/t-demo/doc_1',
      contentHash: 'sha256:beef',
      accessClass: 'INTERNAL_CONFIDENTIAL',
      status: 'AVAILABLE',
      scanNote: null,
      ingestedBy: 'tester',
      createdAt: '2026-08-31T00:00:00.000Z',
      availableAt: '2026-08-31T00:00:01.000Z',
    })

    const linked = await ctx.claims.linkEvidence(auth, asserted.claim.id, {
      documentId: 'doc_1',
      page: 4,
      quote: 'Nominal voltage: 48 V',
    })
    expect(linked).toMatchObject({ ok: true })

    const matrix = await ctx.entities.matrix(auth, ctx.entityId)
    const row = matrix?.rows.find((r) => r.control === CONTROL)
    expect(row?.readiness).toBe('EVIDENCED')
    expect(row?.evidenceCount).toBe(1)

    expect(
      await ctx.claims.linkEvidence(auth, asserted.claim.id, { documentId: 'doc_missing' }),
    ).toMatchObject({ ok: false, code: 'DOCUMENT_NOT_FOUND' })
  })

  it('a second approved claim supersedes the first (history preserved)', async () => {
    const first = await ctx.claims.assert(auth, ctx.entityId, CONTROL, { value: 'v1' })
    if (!first.ok) throw new Error()
    await ctx.claims.decide(auth, first.claim.id, { decision: 'APPROVED' })

    const second = await ctx.claims.assert(auth, ctx.entityId, CONTROL, { value: 'v2' })
    if (!second.ok) throw new Error()
    expect(second.claim.revision).toBe(2)
    await ctx.claims.decide(auth, second.claim.id, { decision: 'APPROVED' })

    const forControl = ctx.stores.claims.filter((c) => c.controlKey === CONTROL)
    expect(forControl.map((c) => `${c.value}:${c.status}`).sort()).toEqual([
      'v1:SUPERSEDED',
      'v2:APPROVED',
    ])

    const matrix = await ctx.entities.matrix(auth, ctx.entityId)
    const row = matrix?.rows.find((r) => r.control === CONTROL)
    expect(row?.readiness).toBe('SELF_ATTESTED')
    expect(row?.approvedValue).toBe('v2')
  })

  it('rejecting requires a reason and leaves the control MISSING again', async () => {
    const asserted = await ctx.claims.assert(auth, ctx.entityId, CONTROL, { value: 'x' })
    if (!asserted.ok) throw new Error()

    const noReason = await ctx.claims.decide(auth, asserted.claim.id, { decision: 'REJECTED' })
    expect(noReason).toMatchObject({ ok: false, code: 'REASON_REQUIRED' })

    const rejected = await ctx.claims.decide(auth, asserted.claim.id, {
      decision: 'REJECTED',
      reason: 'unit is wrong',
    })
    expect(rejected.ok).toBe(true)

    const matrix = await ctx.entities.matrix(auth, ctx.entityId)
    expect(matrix?.rows.find((r) => r.control === CONTROL)?.readiness).toBe('MISSING')
    // the rejected claim is still there for the record
    expect(ctx.stores.claims.some((c) => c.status === 'REJECTED')).toBe(true)
  })

  it('cannot claim against a control that does not apply to the entity', async () => {
    // EAA-EN549-10-1-1-1 is NOT_APPLICABLE for the bank fixture (no downloadable docs)
    const res = await ctx.claims.assert(auth, ctx.entityId, 'EAA-EN549-10-1-1-1', { value: 'x' })
    expect(res).toMatchObject({ ok: false, code: 'CONTROL_NOT_APPLICABLE' })
  })

  it('does not act on another tenant’s claim', async () => {
    const asserted = await ctx.claims.assert(auth, ctx.entityId, CONTROL, { value: 'x' })
    if (!asserted.ok) throw new Error()
    const other: AuthContext = { tenantId: 't-other', actor: 'x' }
    const res = await ctx.claims.decide(other, asserted.claim.id, { decision: 'APPROVED' })
    expect(res).toMatchObject({ ok: false, code: 'CLAIM_NOT_FOUND' })
  })
})
