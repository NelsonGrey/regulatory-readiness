import type { Pool } from 'pg'
import type {
  BillingRepository,
  SubscriptionPatch,
  SubscriptionRecord,
} from '../services/billing.js'

interface Row {
  id: string
  tenant_id: string
  plan: SubscriptionRecord['plan']
  status: SubscriptionRecord['status']
  trial_ends_at: Date | null
  current_period_end: Date | null
  provider: SubscriptionRecord['provider']
  provider_customer_id: string | null
  provider_subscription_id: string | null
  created_at: Date
  updated_at: Date
}

const toRecord = (r: Row): SubscriptionRecord => ({
  id: r.id,
  tenantId: r.tenant_id,
  plan: r.plan,
  status: r.status,
  trialEndsAt: r.trial_ends_at ? r.trial_ends_at.toISOString() : null,
  currentPeriodEnd: r.current_period_end ? r.current_period_end.toISOString() : null,
  provider: r.provider,
  providerCustomerId: r.provider_customer_id,
  providerSubscriptionId: r.provider_subscription_id,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
})

/** The subscription control plane on a plain pool — no RLS, scoped by argument. */
export class PgBillingRepository implements BillingRepository {
  constructor(private readonly pool: Pool) {}

  async get(tenantId: string): Promise<SubscriptionRecord | null> {
    const r = await this.pool.query<Row>(`SELECT * FROM subscription WHERE tenant_id = $1`, [
      tenantId,
    ])
    return r.rows[0] ? toRecord(r.rows[0]) : null
  }

  async getByCustomer(customerId: string): Promise<SubscriptionRecord | null> {
    const r = await this.pool.query<Row>(
      `SELECT * FROM subscription WHERE provider_customer_id = $1`,
      [customerId],
    )
    return r.rows[0] ? toRecord(r.rows[0]) : null
  }

  async insert(s: SubscriptionRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO subscription
         (id, tenant_id, plan, status, trial_ends_at, current_period_end, provider,
          provider_customer_id, provider_subscription_id, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [
        s.id,
        s.tenantId,
        s.plan,
        s.status,
        s.trialEndsAt,
        s.currentPeriodEnd,
        s.provider,
        s.providerCustomerId,
        s.providerSubscriptionId,
        s.createdAt,
        s.updatedAt,
      ],
    )
  }

  async update(tenantId: string, patch: SubscriptionPatch): Promise<void> {
    await this.pool.query(
      `UPDATE subscription SET
         plan = COALESCE($2, plan),
         status = COALESCE($3, status),
         current_period_end = CASE WHEN $4::boolean THEN $5 ELSE current_period_end END,
         provider = COALESCE($6, provider),
         provider_customer_id = COALESCE($7, provider_customer_id),
         provider_subscription_id = COALESCE($8, provider_subscription_id),
         updated_at = $9
       WHERE tenant_id = $1`,
      [
        tenantId,
        patch.plan ?? null,
        patch.status ?? null,
        patch.currentPeriodEnd !== undefined,
        patch.currentPeriodEnd ?? null,
        patch.provider ?? null,
        patch.providerCustomerId ?? null,
        patch.providerSubscriptionId ?? null,
        patch.updatedAt,
      ],
    )
  }
}
