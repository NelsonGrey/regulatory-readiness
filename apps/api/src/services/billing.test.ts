import { beforeEach, describe, expect, it } from 'vitest'
import type { RegulatedEntity } from '@rre/domain'
import { createInMemoryStores, inMemoryUnitOfWork, type InMemoryStores } from '../db/uow.js'
import { InMemoryAccountsRepository } from './accounts.js'
import { BillingService, InMemoryBillingRepository } from './billing.js'
import { noopBillingProvider } from '../billing/provider.js'

const T = 't-demo'
const NOW = new Date('2026-09-01T00:00:00.000Z')

function seedEntity(stores: InMemoryStores, id: string): void {
  stores.entities.set(id, {
    id,
    tenantId: T,
    packKey: 'eaa-accessibility',
    name: id,
    entityIdentifier: id,
    entityKind: 'service',
    createdAt: NOW.toISOString(),
    createdBy: 'tester',
    currentEvaluationId: `${id}-eval`,
  } as RegulatedEntity)
}

function setup() {
  const stores = createInMemoryStores()
  const uow = inMemoryUnitOfWork(stores)
  const accounts = new InMemoryAccountsRepository()
  const repo = new InMemoryBillingRepository()
  const billing = new BillingService(repo, noopBillingProvider(), accounts, uow)
  return { stores, accounts, repo, billing }
}

describe('BillingService', () => {
  let ctx: ReturnType<typeof setup>
  beforeEach(() => {
    ctx = setup()
  })

  it('ensureTrial creates a 14-day trial once', async () => {
    await ctx.billing.ensureTrial(T, NOW)
    await ctx.billing.ensureTrial(T, NOW) // idempotent
    expect(ctx.repo.rows).toHaveLength(1)
    expect(ctx.repo.rows[0]).toMatchObject({ plan: 'trial', status: 'trialing' })
    expect(ctx.repo.rows[0]!.trialEndsAt).toBe('2026-09-15T00:00:00.000Z')
  })

  it('summary reports plan, limits and live usage', async () => {
    await ctx.billing.ensureTrial(T, NOW)
    seedEntity(ctx.stores, 'ent_1')
    ctx.accounts.memberships.push({
      id: 'm1',
      tenantId: T,
      userId: 'u1',
      role: 'owner',
      invitedBy: null,
      createdAt: NOW.toISOString(),
    })

    const s = await ctx.billing.summary(T)
    expect(s).toMatchObject({
      plan: 'trial',
      limits: { entities: 3, seats: 3 },
      usage: { entities: 1, seats: 1 },
    })
  })

  it('assertCanAdd blocks entities and seats at the trial limit', async () => {
    await ctx.billing.ensureTrial(T, NOW)
    for (const id of ['ent_1', 'ent_2', 'ent_3']) seedEntity(ctx.stores, id)
    expect(await ctx.billing.assertCanAdd(T, 'entities')).toMatchObject({
      ok: false,
      code: 'QUOTA_EXCEEDED',
      resource: 'entities',
      limit: 3,
    })

    for (const uid of ['a', 'b', 'c']) {
      ctx.accounts.memberships.push({
        id: `m_${uid}`,
        tenantId: T,
        userId: uid,
        role: 'member',
        invitedBy: null,
        createdAt: NOW.toISOString(),
      })
    }
    expect(await ctx.billing.assertCanAdd(T, 'seats')).toMatchObject({
      ok: false,
      resource: 'seats',
    })
  })

  it('growth plan has no finite entity limit', async () => {
    await ctx.billing.ensureTrial(T, NOW)
    await ctx.billing.applyEvent(
      {
        type: 'checkout.completed',
        tenantId: T,
        plan: 'growth',
        customerId: 'cus_1',
        subscriptionId: 'sub_1',
      },
      NOW,
    )
    for (const id of ['e1', 'e2', 'e3', 'e4', 'e5']) seedEntity(ctx.stores, id)
    expect(await ctx.billing.assertCanAdd(T, 'entities')).toEqual({ ok: true })
    expect((await ctx.billing.summary(T)).plan).toBe('growth')
  })

  it('applies checkout, update and cancellation events', async () => {
    await ctx.billing.ensureTrial(T, NOW)
    await ctx.billing.applyEvent(
      {
        type: 'checkout.completed',
        tenantId: T,
        plan: 'starter',
        customerId: 'cus_9',
        subscriptionId: 'sub_9',
      },
      NOW,
    )
    expect(ctx.repo.rows[0]).toMatchObject({
      plan: 'starter',
      status: 'active',
      provider: 'stripe',
      providerCustomerId: 'cus_9',
    })

    await ctx.billing.applyEvent(
      {
        type: 'subscription.updated',
        customerId: 'cus_9',
        status: 'past_due',
        currentPeriodEnd: null,
      },
      NOW,
    )
    expect(ctx.repo.rows[0]!.status).toBe('past_due')

    await ctx.billing.applyEvent({ type: 'subscription.canceled', customerId: 'cus_9' }, NOW)
    expect(ctx.repo.rows[0]).toMatchObject({ status: 'canceled', plan: 'trial' })
  })
})
