import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import { createPool, migrate } from '@rre/db'
import { pgUnitOfWork } from '../db/uow.js'
import { PgBillingRepository } from './billing.pg.js'
import { PgAccountsRepository } from './accounts.pg.js'
import { BillingService } from '../services/billing.js'
import { noopBillingProvider } from '../billing/provider.js'

const adminUrl = process.env.TEST_DATABASE_URL
const appUrl =
  process.env.TEST_DATABASE_URL_APP ?? adminUrl?.replace(/\/\/[^:]+:[^@]+@/, '//rre_app:rre_app@')
const suite = adminUrl ? describe : describe.skip

const AT = '2026-09-01T00:00:00.000Z'

suite('Postgres subscription repository (integration)', () => {
  let adminPool: Pool
  let appPool: Pool
  let repo: PgBillingRepository
  let billing: BillingService

  beforeAll(async () => {
    adminPool = createPool(adminUrl as string)
    await migrate(adminPool)
    appPool = createPool(appUrl as string)
    repo = new PgBillingRepository(appPool)
    billing = new BillingService(
      repo,
      noopBillingProvider(),
      new PgAccountsRepository(appPool),
      pgUnitOfWork(appPool),
    )
  })

  afterEach(async () => {
    await adminPool.query('TRUNCATE subscription')
  })

  afterAll(async () => {
    await appPool.end()
    await adminPool.end()
  })

  it('inserts once (ON CONFLICT DO NOTHING), reads back, and updates', async () => {
    const base = {
      id: 'sub_1',
      tenantId: 't-alpha',
      plan: 'trial' as const,
      status: 'trialing' as const,
      trialEndsAt: AT,
      currentPeriodEnd: null,
      provider: 'none' as const,
      providerCustomerId: null,
      providerSubscriptionId: null,
      createdAt: AT,
      updatedAt: AT,
    }
    await repo.insert(base)
    await repo.insert({ ...base, id: 'sub_dupe', plan: 'growth' }) // no-op

    const got = await repo.get('t-alpha')
    expect(got).toMatchObject({ id: 'sub_1', plan: 'trial' })

    await repo.update('t-alpha', {
      plan: 'starter',
      status: 'active',
      provider: 'stripe',
      providerCustomerId: 'cus_x',
      currentPeriodEnd: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
    })
    expect(await repo.get('t-alpha')).toMatchObject({
      plan: 'starter',
      status: 'active',
      providerCustomerId: 'cus_x',
      currentPeriodEnd: '2026-10-01T00:00:00.000Z',
    })
    expect(await repo.getByCustomer('cus_x')).toMatchObject({ tenantId: 't-alpha' })
  })

  it('BillingService.ensureTrial + applyEvent round-trip through Postgres', async () => {
    await billing.ensureTrial('t-bravo', new Date(AT))
    expect(await repo.get('t-bravo')).toMatchObject({ plan: 'trial', status: 'trialing' })

    await billing.applyEvent(
      {
        type: 'checkout.completed',
        tenantId: 't-bravo',
        plan: 'growth',
        customerId: 'cus_b',
        subscriptionId: 'sub_b',
      },
      new Date(AT),
    )
    expect(await repo.get('t-bravo')).toMatchObject({
      plan: 'growth',
      status: 'active',
      provider: 'stripe',
    })

    await billing.applyEvent({ type: 'subscription.canceled', customerId: 'cus_b' }, new Date(AT))
    expect(await repo.get('t-bravo')).toMatchObject({ status: 'canceled', plan: 'trial' })
  })
})
