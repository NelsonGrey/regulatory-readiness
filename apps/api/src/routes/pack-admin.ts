import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify'
import { z } from '@rre/contracts'
import { isPlatformAdmin } from '../platform.js'
import type { PrincipalVerifier } from '../auth/verifier.js'
import type { PackGovernanceService } from '../services/pack-governance.js'
import type { PackSourceService } from '../services/pack-source.js'

interface PackAdminRoutesOptions extends FastifyPluginOptions {
  governance: PackGovernanceService
  sources: PackSourceService
  verifier: PrincipalVerifier
  platformAdmins: string[]
}

const ReviewBody = z.object({ note: z.string().max(2000).optional() })

/** Platform-admin pack governance (engine ADR 0005 — activation is data, not a deploy). */
export async function registerPackAdminRoutes(
  app: FastifyInstance,
  opts: PackAdminRoutesOptions,
): Promise<void> {
  async function admin(req: FastifyRequest, reply: FastifyReply): Promise<string | null> {
    const principal = await opts.verifier.verify(req)
    if (!isPlatformAdmin(principal?.email, opts.platformAdmins)) {
      reply
        .code(403)
        .send({ error: { code: 'NOT_PLATFORM_ADMIN', message: 'platform administrator only' } })
      return null
    }
    return principal!.email
  }

  app.get('/admin/packs', async (req, reply) => {
    if (!(await admin(req, reply))) return reply
    return { packs: await opts.governance.overview() }
  })

  app.post('/admin/packs/:packKey/reviews', async (req, reply) => {
    const email = await admin(req, reply)
    if (!email) return reply
    const parsed = ReviewBody.safeParse(req.body ?? {})
    if (!parsed.success) {
      return reply
        .code(422)
        .send({ error: { code: 'INVALID_BODY', message: 'invalid request body' } })
    }
    const { packKey } = req.params as { packKey: string }
    const res = await opts.governance.review(packKey, email, parsed.data.note ?? null)
    if (!res.ok) return reply.code(404).send({ error: { code: res.code, message: res.message } })
    return { ok: true, distinctReviewers: res.distinctReviewers }
  })

  app.post('/admin/packs/:packKey/activate', async (req, reply) => {
    const email = await admin(req, reply)
    if (!email) return reply
    const { packKey } = req.params as { packKey: string }
    const res = await opts.governance.activate(packKey, email)
    if (!res.ok) {
      const code = res.code === 'PACK_NOT_FOUND' ? 404 : 409
      return reply.code(code).send({ error: { code: res.code, message: res.message } })
    }
    return { ok: true, status: 'active', checksum: res.checksum }
  })

  app.post('/admin/packs/:packKey/withdraw', async (req, reply) => {
    const email = await admin(req, reply)
    if (!email) return reply
    const { packKey } = req.params as { packKey: string }
    const res = await opts.governance.withdraw(packKey, email)
    if (!res.ok) return reply.code(409).send({ error: { code: res.code, message: res.message } })
    return { ok: true, status: 'withdrawn' }
  })

  // --- source-of-record monitoring ---

  app.get('/admin/pack-sources', async (req, reply) => {
    if (!(await admin(req, reply))) return reply
    return opts.sources.overview()
  })

  app.post('/admin/pack-sources/sweep', async (req, reply) => {
    if (!(await admin(req, reply))) return reply
    return { ok: true, ...(await opts.sources.sweep()) }
  })

  app.post('/admin/pack-sources/changes/:id/acknowledge', async (req, reply) => {
    const email = await admin(req, reply)
    if (!email) return reply
    const { id } = req.params as { id: string }
    const ok = await opts.sources.acknowledge(id, email)
    if (!ok) {
      return reply
        .code(409)
        .send({ error: { code: 'NOT_OPEN', message: 'no open change with that id' } })
    }
    return { ok: true }
  })
}
