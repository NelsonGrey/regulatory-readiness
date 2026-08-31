import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { PackRegistry } from '../pack-registry.js'
import { createInMemoryStores, inMemoryUnitOfWork, type InMemoryStores } from '../db/uow.js'
import { EntityService } from './entities.js'
import { ContributorService, RequestService } from './requests.js'
import { hashToken } from '../tokens.js'
import type { AuthContext } from '../auth.js'
import { bankEntityRequest } from '../acceptance/helpers.js'

const PACKS_DIR = fileURLToPath(new URL('../../../../packs', import.meta.url))
const auth: AuthContext = { tenantId: 't-demo', actor: 'manager@acme' }

async function setup(): Promise<{
  requests: RequestService
  contributor: ContributorService
  stores: InMemoryStores
  entityId: string
}> {
  const registry = await PackRegistry.load(PACKS_DIR)
  const stores = createInMemoryStores()
  const uow = inMemoryUnitOfWork(stores)
  const resolveGrant = async (h: string) => stores.grants.find((g) => g.tokenHash === h) ?? null
  const entities = new EntityService(uow, registry)
  const requests = new RequestService(uow, registry)
  const contributor = new ContributorService(uow, resolveGrant, registry)
  const created = await entities.create(auth, bankEntityRequest())
  if (!created.ok) throw new Error('setup failed')
  return { requests, contributor, stores, entityId: created.entity.id }
}

describe('RequestService', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => {
    ctx = await setup()
  })

  it('stores only the token hash and a prefix, never the plaintext', async () => {
    const res = await ctx.requests.createRequest(auth, ctx.entityId, {
      controlKeys: ['EAA-EN549-9-1-1-1'],
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const grant = ctx.stores.grants[0]!
    expect(grant.tokenHash).toBe(hashToken(res.token))
    expect(grant.tokenHash).not.toBe(res.token)
    expect(res.token.startsWith(grant.tokenPrefix)).toBe(true)
    expect(new Date(grant.expiresAt).getTime()).toBeGreaterThan(Date.now())
  })

  it('rejects a request for a control that does not apply to the entity', async () => {
    const res = await ctx.requests.createRequest(auth, ctx.entityId, {
      controlKeys: ['EAA-EN549-10-1-1-1'], // NOT_APPLICABLE for the bank fixture
    })
    expect(res).toMatchObject({ ok: false, code: 'INVALID_CONTROL' })
  })

  it('an expired grant is not usable by the contributor view', async () => {
    const created = await ctx.requests.createRequest(
      auth,
      ctx.entityId,
      { controlKeys: ['EAA-EN549-9-1-1-1'], expiresInDays: 1 },
      new Date('2020-01-01T00:00:00.000Z'),
    )
    if (!created.ok) throw new Error()
    const view = await ctx.contributor.view(created.token, new Date('2026-01-01T00:00:00.000Z'))
    expect(view).toMatchObject({ ok: false, code: 'INVALID_LINK' })
  })

  it('enqueues an outbox notification when a request is created', async () => {
    await ctx.requests.createRequest(auth, ctx.entityId, { controlKeys: ['EAA-EN549-9-1-1-1'] })
    expect(ctx.stores.outbox.map((o) => o.topic)).toContain('request.created')
  })
})

describe('ContributorService drafts', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  let token: string
  let itemIds: string[]

  beforeEach(async () => {
    ctx = await setup()
    const created = await ctx.requests.createRequest(auth, ctx.entityId, {
      controlKeys: ['EAA-EN549-9-1-1-1', 'EAA-EN549-9-2-1-1'],
    })
    if (!created.ok) throw new Error('request setup failed')
    token = created.token
    itemIds = created.items.map((i) => i.id)
  })

  it('round-trips a saved draft into the contributor view and overwrites on re-save', async () => {
    const first = await ctx.contributor.saveDraft(token, {
      items: [
        { requestItemId: itemIds[0]!, availabilityState: 'VALUE_SUPPLIED', value: 'draft 1' },
      ],
    })
    expect(first).toMatchObject({ ok: true })

    let view = await ctx.contributor.view(token)
    if (!view.ok) throw new Error()
    expect(view.data.draft).toMatchObject({
      items: [{ requestItemId: itemIds[0], value: 'draft 1' }],
    })

    await ctx.contributor.saveDraft(token, {
      submitterIdentity: 'sam@supplier.example',
      items: [{ requestItemId: itemIds[0]!, availabilityState: 'UNAVAILABLE' }],
    })
    view = await ctx.contributor.view(token)
    if (!view.ok) throw new Error()
    expect(view.data.draft).toEqual({
      submitterIdentity: 'sam@supplier.example',
      items: [{ requestItemId: itemIds[0], availabilityState: 'UNAVAILABLE' }],
    })
    // Only ever one draft row for the request.
    expect(ctx.stores.drafts).toHaveLength(1)
  })

  it('rejects a draft that references an item outside the request', async () => {
    const res = await ctx.contributor.saveDraft(token, {
      items: [{ requestItemId: 'rqi_not_ours', value: 'x' }],
    })
    expect(res).toMatchObject({ ok: false, code: 'UNKNOWN_ITEM' })
  })

  it('clears the draft and notifies once the contributor submits', async () => {
    await ctx.contributor.saveDraft(token, {
      items: [{ requestItemId: itemIds[0]!, availabilityState: 'VALUE_SUPPLIED', value: 'wip' }],
    })
    const submitted = await ctx.contributor.submit(token, {
      items: itemIds.map((id) => ({
        requestItemId: id,
        availabilityState: 'VALUE_SUPPLIED' as const,
        value: 'final',
      })),
    })
    expect(submitted).toMatchObject({ ok: true })
    expect(ctx.stores.drafts).toHaveLength(0)

    const view = await ctx.contributor.view(token)
    if (!view.ok) throw new Error()
    expect(view.data.draft).toBeNull()
    expect(ctx.stores.outbox.map((o) => o.topic)).toContain('request.submitted')
  })

  it('will not accept a draft on a revoked link', async () => {
    const [request] = ctx.stores.requests
    await ctx.requests.revoke(auth, request!.id)
    const res = await ctx.contributor.saveDraft(token, {
      items: [{ requestItemId: itemIds[0]!, value: 'x' }],
    })
    expect(res).toMatchObject({ ok: false, code: 'INVALID_LINK' })
  })
})
