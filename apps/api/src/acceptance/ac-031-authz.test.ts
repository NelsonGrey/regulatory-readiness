/**
 * User-acceptance scenario for AC-031 — every workspace-scoped route is bound to
 * a `membership` (engine TRD §3). With the dev stand-in OFF, a feature route
 * needs a signed-in principal who is a member of the `x-tenant-id` workspace,
 * and owner-only capabilities (deleting the workspace) are enforced by role.
 */
import { describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app.js'
import { createInMemoryStores, inMemoryUnitOfWork } from '../db/uow.js'
import { bankEntityRequest, type InjectResponse } from './helpers.js'

describe('AC-031 — routes bound to membership', () => {
  const withApp = async (fn: (app: FastifyInstance) => Promise<void>): Promise<void> => {
    // devAuth defaults to false — real membership enforcement.
    const app = buildApp({
      logLevel: 'error',
      unitOfWork: inMemoryUnitOfWork(createInMemoryStores()),
    })
    try {
      await fn(app)
    } finally {
      await app.close()
    }
  }
  const body = (r: InjectResponse) => r.json() as Record<string, any>

  const signUp = (app: FastifyInstance, email: string, workspaceName: string) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/sign-up',
      headers: { 'x-user-email': email },
      payload: { workspaceName },
    })

  it('lets a member in, refuses a stranger and the anonymous', async () => {
    await withApp(async (app) => {
      const founder = 'founder@acme.test'
      const ws = body(await signUp(app, founder, 'Acme')).workspace.id as string

      // the owner is a member → 201
      const ok = await app.inject({
        method: 'POST',
        url: '/api/v1/entities',
        headers: { 'x-user-email': founder, 'x-tenant-id': ws },
        payload: bankEntityRequest(),
      })
      expect(ok.statusCode).toBe(201)

      // signed in, but not a member of this workspace → 403
      const stranger = await app.inject({
        method: 'POST',
        url: '/api/v1/entities',
        headers: { 'x-user-email': 'stranger@nope.test', 'x-tenant-id': ws },
        payload: bankEntityRequest(),
      })
      expect(stranger.statusCode).toBe(403)
      expect(body(stranger).error.code).toBe('NOT_A_MEMBER')

      // tenant header but no identity → 401
      const anon = await app.inject({
        method: 'POST',
        url: '/api/v1/entities',
        headers: { 'x-tenant-id': ws },
        payload: bankEntityRequest(),
      })
      expect(anon.statusCode).toBe(401)
      expect(body(anon).error.code).toBe('NO_PRINCIPAL')

      // no tenant header at all → 401
      const noTenant = await app.inject({
        method: 'POST',
        url: '/api/v1/entities',
        headers: { 'x-user-email': founder },
        payload: bankEntityRequest(),
      })
      expect(noTenant.statusCode).toBe(401)
    })
  })

  it('gates deleting the workspace to owners', async () => {
    await withApp(async (app) => {
      const founder = 'founder@acme.test'
      const ws = body(await signUp(app, founder, 'Acme')).workspace.id as string

      // invite a plain member and have them accept
      const invite = await app.inject({
        method: 'POST',
        url: '/api/v1/members/invites',
        headers: { 'x-user-email': founder, 'x-tenant-id': ws },
        payload: { email: 'helper@acme.test', role: 'member' },
      })
      const token = body(invite).token as string
      await app.inject({
        method: 'POST',
        url: '/api/v1/invites/accept',
        headers: { 'x-user-email': 'helper@acme.test' },
        payload: { token },
      })

      // the member can use ordinary feature routes
      const asMember = await app.inject({
        method: 'GET',
        url: '/api/v1/export/tenant',
        headers: { 'x-user-email': 'helper@acme.test', 'x-tenant-id': ws },
      })
      expect(asMember.statusCode).toBe(200)

      // ...but not request a workspace deletion
      const memberDelete = await app.inject({
        method: 'POST',
        url: '/api/v1/deletion-requests',
        headers: { 'x-user-email': 'helper@acme.test', 'x-tenant-id': ws },
        payload: { confirmation: ws },
      })
      expect(memberDelete.statusCode).toBe(403)
      expect(body(memberDelete).error.code).toBe('FORBIDDEN')

      // the owner can
      const ownerDelete = await app.inject({
        method: 'POST',
        url: '/api/v1/deletion-requests',
        headers: { 'x-user-email': founder, 'x-tenant-id': ws },
        payload: { confirmation: ws },
      })
      expect(ownerDelete.statusCode).toBe(201)
    })
  })
})
