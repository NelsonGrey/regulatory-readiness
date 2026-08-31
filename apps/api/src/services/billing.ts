import { randomUUID } from 'node:crypto'
import type { UnitOfWork } from '../db/uow.js'
import type { AccountsRepository } from './accounts.js'
import { limitsFor, type Plan, type PlanLimits } from '../billing/plans.js'
import type { BillingProvider } from '../billing/provider.js'
import type { BillingEvent } from '../billing/stripe-webhook.js'

export interface SubscriptionRecord {
  id: string
  tenantId: string
  plan: Plan
  status: 'trialing' | 'active' | 'past_due' | 'canceled'
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  provider: 'none' | 'stripe'
  providerCustomerId: string | null
  providerSubscriptionId: string | null
  createdAt: string
  updatedAt: string
}

export interface SubscriptionPatch {
  plan?: Plan
  status?: SubscriptionRecord['status']
  currentPeriodEnd?: string | null
  provider?: SubscriptionRecord['provider']
  providerCustomerId?: string | null
  providerSubscriptionId?: string | null
  updatedAt: string
}

export interface BillingRepository {
  get(tenantId: string): Promise<SubscriptionRecord | null>
  getByCustomer(customerId: string): Promise<SubscriptionRecord | null>
  insert(sub: SubscriptionRecord): Promise<void>
  update(tenantId: string, patch: SubscriptionPatch): Promise<void>
}

const TRIAL_MS = 14 * 24 * 60 * 60 * 1000

export interface BillingSummary {
  plan: Plan
  status: SubscriptionRecord['status']
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  limits: { entities: number; seats: number }
  usage: { entities: number; seats: number }
}

export type QuotaCheck =
  | { ok: true }
  | {
      ok: false
      code: 'QUOTA_EXCEEDED'
      resource: 'entities' | 'seats'
      limit: number
      plan: Plan
      message: string
    }

export class BillingService {
  constructor(
    private readonly repo: BillingRepository,
    private readonly provider: BillingProvider,
    private readonly accounts: AccountsRepository,
    private readonly uow: UnitOfWork,
  ) {}

  /** Create the trial subscription for a brand-new workspace (idempotent). */
  async ensureTrial(tenantId: string, now: Date = new Date()): Promise<void> {
    if (await this.repo.get(tenantId)) return
    const at = now.toISOString()
    await this.repo.insert({
      id: `sub_${randomUUID()}`,
      tenantId,
      plan: 'trial',
      status: 'trialing',
      trialEndsAt: new Date(now.getTime() + TRIAL_MS).toISOString(),
      currentPeriodEnd: null,
      provider: 'none',
      providerCustomerId: null,
      providerSubscriptionId: null,
      createdAt: at,
      updatedAt: at,
    })
  }

  async plan(tenantId: string): Promise<Plan> {
    return (await this.repo.get(tenantId))?.plan ?? 'trial'
  }

  private async usage(tenantId: string): Promise<{ entities: number; seats: number }> {
    const counts = await this.uow(tenantId, (u) => u.tenantData.counts())
    const [members, invites] = await Promise.all([
      this.accounts.listMembers(tenantId),
      this.accounts.listPendingInvites(tenantId),
    ])
    return {
      entities: counts.regulated_entity ?? 0,
      seats: members.length + invites.length,
    }
  }

  async summary(tenantId: string): Promise<BillingSummary> {
    const sub = await this.repo.get(tenantId)
    const plan = sub?.plan ?? 'trial'
    const l: PlanLimits = limitsFor(plan)
    return {
      plan,
      status: sub?.status ?? 'trialing',
      trialEndsAt: sub?.trialEndsAt ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      limits: { entities: l.entities, seats: l.seats },
      usage: await this.usage(tenantId),
    }
  }

  async assertCanAdd(tenantId: string, resource: 'entities' | 'seats'): Promise<QuotaCheck> {
    const plan = await this.plan(tenantId)
    const limit = limitsFor(plan)[resource]
    if (!Number.isFinite(limit)) return { ok: true }
    const used = (await this.usage(tenantId))[resource]
    if (used < limit) return { ok: true }
    return {
      ok: false,
      code: 'QUOTA_EXCEEDED',
      resource,
      limit,
      plan,
      message:
        resource === 'entities'
          ? `the ${plan} plan allows ${limit} entities — upgrade to add more`
          : `the ${plan} plan allows ${limit} seats — upgrade to invite more people`,
    }
  }

  async checkout(
    tenantId: string,
    plan: Plan,
    customerEmail: string,
    baseUrl: string,
  ): Promise<{ url: string }> {
    return this.provider.createCheckout({
      tenantId,
      plan,
      customerEmail,
      successUrl: `${baseUrl}/w/settings/billing`,
      cancelUrl: `${baseUrl}/w/settings/billing`,
    })
  }

  async portal(tenantId: string, baseUrl: string): Promise<{ url: string }> {
    const sub = await this.repo.get(tenantId)
    return this.provider.createPortal({
      tenantId,
      customerId: sub?.providerCustomerId ?? null,
      returnUrl: `${baseUrl}/w/settings/billing`,
    })
  }

  /** Apply a verified billing-provider event to the subscription. */
  async applyEvent(event: BillingEvent, now: Date = new Date()): Promise<void> {
    const at = now.toISOString()
    if (event.type === 'checkout.completed') {
      await this.ensureTrial(event.tenantId, now)
      await this.repo.update(event.tenantId, {
        plan: event.plan,
        status: 'active',
        provider: 'stripe',
        providerCustomerId: event.customerId,
        providerSubscriptionId: event.subscriptionId,
        updatedAt: at,
      })
      return
    }
    const sub = await this.repo.getByCustomer(event.customerId)
    if (!sub) return
    if (event.type === 'subscription.updated') {
      await this.repo.update(sub.tenantId, {
        status: mapStatus(event.status),
        ...(event.plan ? { plan: event.plan } : {}),
        currentPeriodEnd:
          event.currentPeriodEnd != null
            ? new Date(event.currentPeriodEnd * 1000).toISOString()
            : null,
        updatedAt: at,
      })
    } else if (event.type === 'subscription.canceled') {
      await this.repo.update(sub.tenantId, { status: 'canceled', plan: 'trial', updatedAt: at })
    }
  }
}

function mapStatus(s: string): SubscriptionRecord['status'] {
  if (s === 'active' || s === 'trialing' || s === 'past_due' || s === 'canceled') return s
  if (s === 'unpaid' || s === 'incomplete_expired') return 'past_due'
  if (s === 'incomplete') return 'trialing'
  return 'active'
}

// --- In-memory repository ----------------------------------------------------

export class InMemoryBillingRepository implements BillingRepository {
  readonly rows: SubscriptionRecord[] = []

  async get(tenantId: string): Promise<SubscriptionRecord | null> {
    return this.rows.find((r) => r.tenantId === tenantId) ?? null
  }
  async getByCustomer(customerId: string): Promise<SubscriptionRecord | null> {
    return this.rows.find((r) => r.providerCustomerId === customerId) ?? null
  }
  async insert(sub: SubscriptionRecord): Promise<void> {
    this.rows.push({ ...sub })
  }
  async update(tenantId: string, patch: SubscriptionPatch): Promise<void> {
    const r = this.rows.find((x) => x.tenantId === tenantId)
    if (!r) return
    if (patch.plan !== undefined) r.plan = patch.plan
    if (patch.status !== undefined) r.status = patch.status
    if (patch.currentPeriodEnd !== undefined) r.currentPeriodEnd = patch.currentPeriodEnd
    if (patch.provider !== undefined) r.provider = patch.provider
    if (patch.providerCustomerId !== undefined) r.providerCustomerId = patch.providerCustomerId
    if (patch.providerSubscriptionId !== undefined)
      r.providerSubscriptionId = patch.providerSubscriptionId
    r.updatedAt = patch.updatedAt
  }
}
