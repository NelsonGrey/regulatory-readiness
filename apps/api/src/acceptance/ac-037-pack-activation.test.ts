/**
 * User-acceptance scenario for AC-037 — a control pack is activated as governed
 * data, not a deploy. A platform admin records the two-person review against the
 * current computed checksum and flips the pack from `draft` to `active`; the
 * change shows through the ordinary `/packs` endpoint and can be withdrawn.
 */
import { describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createInMemoryStores, inMemoryUnitOfWork } from '../db/uow.js'
import { bankEntityRequest, buildTestApp, type InjectResponse } from './helpers.js'

const ADMIN_A = 'ann@rre.test'
const ADMIN_B = 'ben@rre.test'
const PACK = 'eaa-accessibility'

describe('AC-037 — pack activation workflow', () => {
  const withApp = async (fn: (app: FastifyInstance) => Promise<void>): Promise<void> => {
    const app = buildTestApp({
      unitOfWork: inMemoryUnitOfWork(createInMemoryStores()),
      platformAdmins: [ADMIN_A, ADMIN_B],
    })
    try {
      await fn(app)
    } finally {
      await app.close()
    }
  }
  const body = (r: InjectResponse) => r.json() as Record<string, any>
  const asA = { 'x-user-email': ADMIN_A }

  it('two reviews then activation flips the pack, and withdrawal reverts it', async () => {
    await withApp(async (app) => {
      // non-admins cannot see or touch the governance surface
      const outsider = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/packs',
        headers: { 'x-user-email': 'random@nope.test' },
      })
      expect(outsider.statusCode).toBe(403)

      const overview = await app.inject({ method: 'GET', url: '/api/v1/admin/packs', headers: asA })
      expect(overview.statusCode).toBe(200)
      const eaa0 = (body(overview).packs as Array<Record<string, any>>).find(
        (p) => p.packKey === PACK,
      )!
      expect(eaa0.effectiveStatus).toBe('draft')
      expect(eaa0.canActivate).toBe(false)

      // activation is refused until there are two distinct reviewers
      const early = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/packs/${PACK}/activate`,
        headers: asA,
      })
      expect(early.statusCode).toBe(409)
      expect(body(early).error.code).toBe('NEEDS_REVIEWS')

      for (const who of [ADMIN_A, ADMIN_B]) {
        const rev = await app.inject({
          method: 'POST',
          url: `/api/v1/admin/packs/${PACK}/reviews`,
          headers: { 'x-user-email': who },
          payload: { note: `reviewed by ${who}` },
        })
        expect(rev.statusCode).toBe(200)
      }

      const activated = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/packs/${PACK}/activate`,
        headers: asA,
      })
      expect(activated.statusCode).toBe(200)
      expect(body(activated)).toMatchObject({ ok: true, status: 'active' })

      // the public packs endpoint now reports the governed status
      const packs = await app.inject({ method: 'GET', url: '/api/v1/packs' })
      const eaa = (body(packs).packs as Array<Record<string, any>>).find((p) => p.packKey === PACK)!
      expect(eaa.status).toBe('active')
      expect(eaa.onDiskStatus).toBe('draft')

      // withdraw → back to draft
      const withdrawn = await app.inject({
        method: 'POST',
        url: `/api/v1/admin/packs/${PACK}/withdraw`,
        headers: asA,
      })
      expect(withdrawn.statusCode).toBe(200)
      const packs2 = await app.inject({ method: 'GET', url: '/api/v1/packs' })
      expect(
        (body(packs2).packs as Array<Record<string, any>>).find((p) => p.packKey === PACK)!.status,
      ).toBe('draft')
    })
  })

  it('with requirePackActivation, an entity can only be created against an active pack', async () => {
    const app = buildTestApp({
      unitOfWork: inMemoryUnitOfWork(createInMemoryStores()),
      platformAdmins: [ADMIN_A, ADMIN_B],
      requirePackActivation: true,
    })
    try {
      const headers = { 'x-user-email': 'ops@acme.test', 'x-tenant-id': 't-req' }

      const blocked = await app.inject({
        method: 'POST',
        url: '/api/v1/entities',
        headers,
        payload: bankEntityRequest(),
      })
      expect(blocked.statusCode).toBe(409)
      expect(body(blocked).error.code).toBe('PACK_NOT_ACTIVE')

      for (const who of [ADMIN_A, ADMIN_B]) {
        await app.inject({
          method: 'POST',
          url: `/api/v1/admin/packs/${PACK}/reviews`,
          headers: { 'x-user-email': who },
        })
      }
      await app.inject({
        method: 'POST',
        url: `/api/v1/admin/packs/${PACK}/activate`,
        headers: asA,
      })

      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/entities',
        headers,
        payload: bankEntityRequest(),
      })
      expect(created.statusCode).toBe(201)
    } finally {
      await app.close()
    }
  })
})
