/**
 * User-acceptance scenario for AC-033 — plans, trial, and plan-gated limits
 * (engine TRD §3.4). A new workspace is on a 14-day trial with small quotas;
 * creating past the entity limit or inviting past the seat limit is refused with
 * 402; an owner can start an upgrade; a signed provider webhook lifts the plan.
 */
import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createInMemoryStores, inMemoryUnitOfWork } from '../db/uow.js'
import { bankEntityRequest, buildTestApp, type InjectResponse } from './helpers.js'

const WHSEC = 'whsec_test'

describe('AC-033 — plans, trial & limits', () => {
  const withApp = async (fn: (app: FastifyInstance) => Promise<void>): Promise<void> => {
    const app = buildTestApp({
      unitOfWork: inMemoryUnitOfWork(createInMemoryStores()),
      stripeWebhookSecret: WHSEC,
    })
    try {
      await fn(app)
    } finally {
      await app.close()
    }
  }
  const body = (r: InjectResponse) => r.json() as Record<string, any>

  const signUp = async (app: FastifyInstance, email: string): Promise<string> => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/sign-up',
      headers: { 'x-user-email': email },
      payload: { workspaceName: 'Acme' },
    })
    return body(r).workspace.id as string
  }

  it('trial quotas cap entities and seats, and the summary tracks usage', async () => {
    await withApp(async (app) => {
      const founder = 'founder@acme.test'
      const ws = await signUp(app, founder)
      const h = { 'x-user-email': founder, 'x-tenant-id': ws }

      const summary0 = await app.inject({ method: 'GET', url: '/api/v1/billing', headers: h })
      expect(body(summary0)).toMatchObject({
        plan: 'trial',
        status: 'trialing',
        limits: { entities: 3, seats: 3 },
        usage: { entities: 0, seats: 1 },
      })

      for (const n of [1, 2, 3]) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/entities',
          headers: h,
          payload: { ...bankEntityRequest(), entityIdentifier: `acme-${n}` },
        })
        expect(res.statusCode).toBe(201)
      }
      const fourth = await app.inject({
        method: 'POST',
        url: '/api/v1/entities',
        headers: h,
        payload: { ...bankEntityRequest(), entityIdentifier: 'acme-4' },
      })
      expect(fourth.statusCode).toBe(402)
      expect(body(fourth).error).toMatchObject({ code: 'QUOTA_EXCEEDED' })

      // founder = 1 seat; two invites fill it; the third is refused
      for (const who of ['a@acme.test', 'b@acme.test']) {
        const inv = await app.inject({
          method: 'POST',
          url: '/api/v1/members/invites',
          headers: h,
          payload: { email: who, role: 'member' },
        })
        expect(inv.statusCode).toBe(201)
      }
      const over = await app.inject({
        method: 'POST',
        url: '/api/v1/members/invites',
        headers: h,
        payload: { email: 'c@acme.test', role: 'member' },
      })
      expect(over.statusCode).toBe(402)
      expect(body(over).error).toMatchObject({ code: 'SEAT_LIMIT' })

      const summary1 = await app.inject({ method: 'GET', url: '/api/v1/billing', headers: h })
      expect(body(summary1).usage).toEqual({ entities: 3, seats: 3 })
    })
  })

  it('checkout is owner-only; a signed webhook upgrades the plan and lifts the limit', async () => {
    await withApp(async (app) => {
      const founder = 'founder@acme.test'
      const ws = await signUp(app, founder)
      const fh = { 'x-user-email': founder, 'x-tenant-id': ws }

      // bring a plain member on board
      const inv = await app.inject({
        method: 'POST',
        url: '/api/v1/members/invites',
        headers: fh,
        payload: { email: 'helper@acme.test', role: 'member' },
      })
      await app.inject({
        method: 'POST',
        url: '/api/v1/invites/accept',
        headers: { 'x-user-email': 'helper@acme.test' },
        payload: { token: body(inv).token },
      })

      const asMember = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        headers: { 'x-user-email': 'helper@acme.test', 'x-tenant-id': ws },
        payload: { plan: 'starter' },
      })
      expect(asMember.statusCode).toBe(403)

      const asOwner = await app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        headers: fh,
        payload: { plan: 'starter' },
      })
      expect(asOwner.statusCode).toBe(200)
      expect(body(asOwner).url).toContain('mock_checkout=starter')

      // the provider confirms via webhook
      const payload = JSON.stringify({
        type: 'checkout.session.completed',
        data: {
          object: {
            customer: 'cus_777',
            subscription: 'sub_777',
            metadata: { tenant_id: ws, plan: 'starter' },
          },
        },
      })
      const t = Math.floor(Date.now() / 1000)
      const sig = `t=${t},v1=${createHmac('sha256', WHSEC).update(`${t}.${payload}`).digest('hex')}`
      const hook = await app.inject({
        method: 'POST',
        url: '/webhooks/stripe',
        headers: { 'content-type': 'application/json', 'stripe-signature': sig },
        payload,
      })
      expect(hook.statusCode).toBe(200)

      const summary = await app.inject({ method: 'GET', url: '/api/v1/billing', headers: fh })
      expect(body(summary)).toMatchObject({
        plan: 'starter',
        status: 'active',
        limits: { entities: 25, seats: 10 },
      })

      // a bad signature is rejected
      const bad = await app.inject({
        method: 'POST',
        url: '/webhooks/stripe',
        headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=deadbeef' },
        payload,
      })
      expect(bad.statusCode).toBe(400)
    })
  })
})
