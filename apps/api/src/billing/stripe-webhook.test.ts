import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { parseStripeEvent, verifyStripeSignature } from './stripe-webhook.js'

const SECRET = 'whsec_test'

function sign(body: string, at = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac('sha256', SECRET).update(`${at}.${body}`).digest('hex')
  return `t=${at},v1=${v1}`
}

describe('verifyStripeSignature', () => {
  it('accepts a correctly-signed, fresh payload', () => {
    const body = '{"hello":"world"}'
    expect(verifyStripeSignature(body, sign(body), SECRET)).toBe(true)
  })

  it('rejects a wrong secret, tampered body, missing or stale signature', () => {
    const body = '{"a":1}'
    expect(verifyStripeSignature(body, sign(body), 'whsec_other')).toBe(false)
    expect(verifyStripeSignature('{"a":2}', sign(body), SECRET)).toBe(false)
    expect(verifyStripeSignature(body, undefined, SECRET)).toBe(false)
    const stale = sign(body, Math.floor(Date.now() / 1000) - 3600)
    expect(verifyStripeSignature(body, stale, SECRET)).toBe(false)
  })
})

describe('parseStripeEvent', () => {
  it('maps a completed checkout session', () => {
    const raw = JSON.stringify({
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_1',
          subscription: 'sub_1',
          metadata: { tenant_id: 'wsp_1', plan: 'starter' },
        },
      },
    })
    expect(parseStripeEvent(raw)).toEqual({
      type: 'checkout.completed',
      tenantId: 'wsp_1',
      plan: 'starter',
      customerId: 'cus_1',
      subscriptionId: 'sub_1',
    })
  })

  it('maps a subscription update, resolving the plan from the price id', () => {
    const raw = JSON.stringify({
      type: 'customer.subscription.updated',
      data: {
        object: {
          customer: 'cus_2',
          status: 'active',
          current_period_end: 1_780_000_000,
          items: { data: [{ price: { id: 'price_growth' } }] },
        },
      },
    })
    expect(parseStripeEvent(raw, (id) => (id === 'price_growth' ? 'growth' : undefined))).toEqual({
      type: 'subscription.updated',
      customerId: 'cus_2',
      status: 'active',
      currentPeriodEnd: 1_780_000_000,
      plan: 'growth',
    })
  })

  it('maps a cancellation and ignores unknown events', () => {
    expect(
      parseStripeEvent(
        JSON.stringify({
          type: 'customer.subscription.deleted',
          data: { object: { customer: 'c' } },
        }),
      ),
    ).toEqual({ type: 'subscription.canceled', customerId: 'c' })
    expect(
      parseStripeEvent(JSON.stringify({ type: 'invoice.paid', data: { object: {} } })),
    ).toBeNull()
    expect(parseStripeEvent('not json')).toBeNull()
  })
})
