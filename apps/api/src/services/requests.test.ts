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
})
