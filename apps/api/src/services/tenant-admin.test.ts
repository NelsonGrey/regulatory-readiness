import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { PackRegistry } from '../pack-registry.js'
import { createInMemoryStores, inMemoryUnitOfWork, type InMemoryStores } from '../db/uow.js'
import { EntityService } from './entities.js'
import { TenantAdminService } from './tenant-admin.js'
import { createLocalObjectStore, originalKey, type ObjectStore } from '../storage/object-store.js'
import type { AuthContext } from '../auth.js'
import { bankEntityRequest } from '../acceptance/helpers.js'

const PACKS_DIR = fileURLToPath(new URL('../../../../packs', import.meta.url))
const auth: AuthContext = { tenantId: 't-demo', actor: 'owner@acme' }
const other: AuthContext = { tenantId: 't-other', actor: 'owner@else' }

async function setup(): Promise<{
  admin: TenantAdminService
  stores: InMemoryStores
  store: ObjectStore
  entityId: string
  otherEntityId: string
}> {
  const registry = await PackRegistry.load(PACKS_DIR)
  const stores = createInMemoryStores()
  const uow = inMemoryUnitOfWork(stores)
  const entities = new EntityService(uow, registry)

  const mine = await entities.create(auth, bankEntityRequest())
  if (!mine.ok) throw new Error('setup failed')
  // a second tenant's row that must survive the purge
  const theirs = await entities.create(other, bankEntityRequest())
  if (!theirs.ok) throw new Error('setup failed')

  const store = createLocalObjectStore()
  await store.put?.(originalKey('t-demo', mine.entity.id), Buffer.from('pdf'))
  await store.put?.(originalKey('t-other', theirs.entity.id), Buffer.from('pdf'))

  return {
    admin: new TenantAdminService(uow, store),
    stores,
    store,
    entityId: mine.entity.id,
    otherEntityId: theirs.entity.id,
  }
}

describe('TenantAdminService', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => {
    ctx = await setup()
  })

  it('exports a bundle of every tenant table and audits it', async () => {
    const bundle = await ctx.admin.exportBundle(auth)
    expect(bundle.tenantId).toBe('t-demo')
    expect(bundle.counts.regulated_entity).toBe(1)
    expect(bundle.tables.regulated_entity).toHaveLength(1)
    // the other tenant's row is never in the bundle
    const dumped = bundle.tables.regulated_entity as Array<{ tenantId: string }>
    expect(dumped.every((r) => r.tenantId === 't-demo')).toBe(true)
    expect(ctx.stores.audit.map((a) => a.action)).toContain('tenant.exported')
  })

  it('requires the confirmation to equal the workspace id', async () => {
    expect(await ctx.admin.requestDeletion(auth, { confirmation: 'nope' })).toMatchObject({
      ok: false,
      code: 'CONFIRMATION_MISMATCH',
    })
  })

  it('records a deletion request with a preview of what would be purged', async () => {
    const res = await ctx.admin.requestDeletion(auth, { confirmation: 't-demo' })
    if (!res.ok) throw new Error('expected ok')
    expect(res.preview.regulated_entity).toBe(1)
    expect(res.preview.entity_scope_evaluation).toBe(1)

    const list = await ctx.admin.listDeletionRequests(auth)
    expect(list).toHaveLength(1)
    expect(list[0]!.status).toBe('REQUESTED')
    expect(ctx.stores.audit.map((a) => a.action)).toContain('deletion.requested')
  })

  it('executes a deletion: purges every tenant row + object, keeps the tombstone', async () => {
    const req = await ctx.admin.requestDeletion(auth, { confirmation: 't-demo' })
    if (!req.ok) throw new Error('expected ok')

    const res = await ctx.admin.executeDeletion(auth, req.deletionRequestId, {
      confirmation: 't-demo',
    })
    if (!res.ok) throw new Error('expected ok')
    expect(res.purged.regulated_entity).toBe(1)
    expect(res.objectsRemoved).toBe(1)

    // every business table for t-demo is empty
    expect([...ctx.stores.entities.values()].filter((e) => e.tenantId === 't-demo')).toHaveLength(0)
    expect(
      [...ctx.stores.evaluations.values()].filter((e) => e.tenantId === 't-demo'),
    ).toHaveLength(0)
    // the other tenant is untouched
    expect([...ctx.stores.entities.values()].filter((e) => e.tenantId === 't-other')).toHaveLength(
      1,
    )
    expect(await ctx.store.head(originalKey('t-other', ctx.otherEntityId))).not.toBeNull()

    // the deletion_request tombstone survives, marked COMPLETED
    const list = await ctx.admin.listDeletionRequests(auth)
    expect(list).toHaveLength(1)
    expect(list[0]!.status).toBe('COMPLETED')
    expect(list[0]!.purged?.regulated_entity).toBe(1)

    // the only surviving audit row for t-demo is the completion tombstone
    const tenantAudit = ctx.stores.audit.filter((a) => a.tenantId === 't-demo')
    expect(tenantAudit.map((a) => a.action)).toEqual(['deletion.completed'])
  })

  it('will not execute a request twice or one that does not exist', async () => {
    const req = await ctx.admin.requestDeletion(auth, { confirmation: 't-demo' })
    if (!req.ok) throw new Error('expected ok')
    await ctx.admin.executeDeletion(auth, req.deletionRequestId, { confirmation: 't-demo' })

    expect(
      await ctx.admin.executeDeletion(auth, req.deletionRequestId, { confirmation: 't-demo' }),
    ).toMatchObject({ ok: false, code: 'NOT_PENDING' })
    expect(
      await ctx.admin.executeDeletion(auth, 'del_missing', { confirmation: 't-demo' }),
    ).toMatchObject({ ok: false, code: 'NOT_FOUND' })
    expect(
      await ctx.admin.executeDeletion(auth, req.deletionRequestId, { confirmation: 'wrong' }),
    ).toMatchObject({ ok: false, code: 'CONFIRMATION_MISMATCH' })
  })
})
