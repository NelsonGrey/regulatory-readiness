import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Plan } from './plans.js'

/**
 * Verify a Stripe webhook signature (`Stripe-Signature: t=…,v1=…`) without the
 * SDK: HMAC-SHA256 over `${t}.${rawBody}` keyed by the endpoint secret, compared
 * in constant time, with a freshness window on `t`.
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
  opts: { toleranceSec?: number; now?: () => number } = {},
): boolean {
  if (!signatureHeader) return false
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const i = kv.indexOf('=')
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()]
    }),
  )
  const t = Number(parts['t'])
  const v1 = parts['v1']
  if (!Number.isFinite(t) || !v1) return false

  const tolerance = opts.toleranceSec ?? 300
  const nowSec = Math.floor((opts.now?.() ?? Date.now()) / 1000)
  if (Math.abs(nowSec - t) > tolerance) return false

  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(v1)
  return a.length === b.length && timingSafeEqual(a, b)
}

export type BillingEvent =
  | {
      type: 'checkout.completed'
      tenantId: string
      plan: Plan
      customerId: string
      subscriptionId: string
    }
  | {
      type: 'subscription.updated'
      customerId: string
      status: string
      currentPeriodEnd: number | null
      plan?: Plan
    }
  | { type: 'subscription.canceled'; customerId: string }

interface StripeEnvelope {
  type: string
  data: { object: Record<string, unknown> }
}

/**
 * Map the Stripe events we care about onto a small internal shape. `priceToPlan`
 * resolves a Stripe price id to a plan (from `STRIPE_PRICE_*` config); metadata
 * `plan` / `tenant_id` on the checkout session are the primary source.
 */
export function parseStripeEvent(
  rawBody: string,
  priceToPlan: (priceId: string) => Plan | undefined = () => undefined,
): BillingEvent | null {
  let env: StripeEnvelope
  try {
    env = JSON.parse(rawBody) as StripeEnvelope
  } catch {
    return null
  }
  const obj = env.data?.object ?? {}

  if (env.type === 'checkout.session.completed') {
    const md = (obj['metadata'] as Record<string, string> | undefined) ?? {}
    const plan = md['plan'] as Plan | undefined
    const tenantId = md['tenant_id']
    const customerId = obj['customer'] as string | undefined
    const subscriptionId = obj['subscription'] as string | undefined
    if (!plan || !tenantId || !customerId || !subscriptionId) return null
    return { type: 'checkout.completed', tenantId, plan, customerId, subscriptionId }
  }

  if (env.type === 'customer.subscription.updated') {
    const customerId = obj['customer'] as string | undefined
    if (!customerId) return null
    const status = String(obj['status'] ?? 'active')
    const cpe = obj['current_period_end']
    const priceId = (obj['items'] as { data?: Array<{ price?: { id?: string } }> } | undefined)
      ?.data?.[0]?.price?.id
    return {
      type: 'subscription.updated',
      customerId,
      status,
      currentPeriodEnd: typeof cpe === 'number' ? cpe : null,
      plan: priceId ? priceToPlan(priceId) : undefined,
    }
  }

  if (env.type === 'customer.subscription.deleted') {
    const customerId = obj['customer'] as string | undefined
    if (!customerId) return null
    return { type: 'subscription.canceled', customerId }
  }

  return null
}
