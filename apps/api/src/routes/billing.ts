import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { StartCheckoutRequest } from '@rre/contracts'
import { authFromRequest } from '../auth.js'
import { can } from '../rbac.js'
import { limitsToJson, limitsFor } from '../billing/plans.js'
import type { BillingService } from '../services/billing.js'

interface BillingRoutesOptions extends FastifyPluginOptions {
  billing: BillingService
  /** Absolute base URL for provider redirect targets. */
  appBaseUrl: string
}

const NO_TENANT = { error: { code: 'NO_TENANT', message: 'x-tenant-id header is required' } }

/** Plan, usage, and the upgrade / manage redirects (engine TRD §3.4). */
export async function registerBillingRoutes(
  app: FastifyInstance,
  opts: BillingRoutesOptions,
): Promise<void> {
  app.get('/billing', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    const s = await opts.billing.summary(auth.tenantId)
    return {
      plan: s.plan,
      status: s.status,
      trialEndsAt: s.trialEndsAt,
      currentPeriodEnd: s.currentPeriodEnd,
      limits: limitsToJson(limitsFor(s.plan)),
      usage: s.usage,
    }
  })

  app.post('/billing/checkout', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    if (!can(req.workspaceRole ?? 'member', 'manage_billing')) {
      return reply
        .code(403)
        .send({ error: { code: 'FORBIDDEN', message: 'only an owner can change billing' } })
    }
    const parsed = StartCheckoutRequest.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'INVALID_BODY',
          message: 'invalid request body',
          details: parsed.error.issues,
        },
      })
    }
    try {
      const { url } = await opts.billing.checkout(
        auth.tenantId,
        parsed.data.plan,
        auth.actor,
        opts.appBaseUrl,
      )
      return { url }
    } catch (e) {
      return reply
        .code(502)
        .send({ error: { code: 'PROVIDER_ERROR', message: (e as Error).message } })
    }
  })

  app.post('/billing/portal', async (req, reply) => {
    const auth = authFromRequest(req)
    if (!auth) return reply.code(401).send(NO_TENANT)
    if (!can(req.workspaceRole ?? 'member', 'manage_billing')) {
      return reply
        .code(403)
        .send({ error: { code: 'FORBIDDEN', message: 'only an owner can change billing' } })
    }
    try {
      const { url } = await opts.billing.portal(auth.tenantId, opts.appBaseUrl)
      return { url }
    } catch (e) {
      return reply
        .code(502)
        .send({ error: { code: 'PROVIDER_ERROR', message: (e as Error).message } })
    }
  })
}
