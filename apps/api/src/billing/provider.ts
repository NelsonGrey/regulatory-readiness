import type { Plan } from './plans.js'

export interface CheckoutInput {
  tenantId: string
  plan: Plan
  customerEmail: string
  successUrl: string
  cancelUrl: string
}

export interface PortalInput {
  tenantId: string
  customerId: string | null
  returnUrl: string
}

/**
 * A billing back-end. `noop` returns a local URL so the flow works end-to-end in
 * dev and tests; a real adapter (Stripe below) implements the same interface.
 */
export interface BillingProvider {
  readonly kind: 'noop' | 'stripe'
  createCheckout(input: CheckoutInput): Promise<{ url: string }>
  createPortal(input: PortalInput): Promise<{ url: string }>
}

/** Default: no external provider — "checkout" just returns to the billing page. */
export function noopBillingProvider(): BillingProvider {
  return {
    kind: 'noop',
    async createCheckout({ plan, successUrl }) {
      const sep = successUrl.includes('?') ? '&' : '?'
      return { url: `${successUrl}${sep}mock_checkout=${plan}` }
    },
    async createPortal({ returnUrl }) {
      return { url: returnUrl }
    },
  }
}

export interface StripeConfig {
  secretKey: string
  /** Stripe price id per plan (from `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_GROWTH`). */
  prices: Partial<Record<Plan, string>>
  fetchImpl?: typeof fetch
}

/**
 * Stripe via its plain HTTP API (form-encoded; no SDK). Only the two redirect
 * flows live here — subscription state arrives through the webhook.
 */
export function stripeBillingProvider(cfg: StripeConfig): BillingProvider {
  const doFetch = cfg.fetchImpl ?? fetch
  const auth = `Bearer ${cfg.secretKey}`

  async function post(
    path: string,
    form: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const res = await doFetch(`https://api.stripe.com/v1/${path}`, {
      method: 'POST',
      headers: { authorization: auth, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
    })
    const body = (await res.json()) as Record<string, unknown>
    if (!res.ok) throw new Error(`stripe ${path} failed: ${res.status}`)
    return body
  }

  return {
    kind: 'stripe',
    async createCheckout({ tenantId, plan, customerEmail, successUrl, cancelUrl }) {
      const price = cfg.prices[plan]
      if (!price) throw new Error(`no Stripe price configured for plan "${plan}"`)
      const body = await post('checkout/sessions', {
        mode: 'subscription',
        'line_items[0][price]': price,
        'line_items[0][quantity]': '1',
        customer_email: customerEmail,
        success_url: successUrl,
        cancel_url: cancelUrl,
        'metadata[tenant_id]': tenantId,
        'metadata[plan]': plan,
        'subscription_data[metadata][tenant_id]': tenantId,
      })
      return { url: String(body['url']) }
    },
    async createPortal({ customerId, returnUrl }) {
      if (!customerId) throw new Error('no Stripe customer for this workspace yet')
      const body = await post('billing_portal/sessions', {
        customer: customerId,
        return_url: returnUrl,
      })
      return { url: String(body['url']) }
    },
  }
}
