/**
 * User-acceptance scenario for AC-030 — self-serve workspaces & teammates
 * (engine TRD §3). A person signs up (first sign-in mints their workspace),
 * invites a teammate who joins with their own verified email, roles are managed,
 * and the last owner cannot be removed.
 */
import { describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app.js'
import { createInMemoryStores, inMemoryUnitOfWork } from '../db/uow.js'
import type { InjectResponse } from './helpers.js'

const ownerH = { 'x-user-email': 'owner@acme.test', 'x-user-name': 'Ola Owner' }
const mateH = { 'x-user-email': 'mate@acme.test', 'x-user-name': 'Mac Mate' }

describe('AC-030 — self-serve workspaces & teammates', () => {
  const withApp = async (fn: (app: FastifyInstance) => Promise<void>): Promise<void> => {
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

  it('sign up → invite → join → manage roles → last-owner guard', async () => {
    await withApp(async (app) => {
      // 1. First sign-in creates the workspace, caller is owner.
      const signup = await app.inject({
        method: 'POST',
        url: '/api/v1/sign-up',
        headers: ownerH,
        payload: { workspaceName: 'Acme Bakery' },
      })
      expect(signup.statusCode).toBe(201)
      const workspaceId = body(signup).workspace.id as string
      expect(body(signup).workspace.slug).toMatch(/^acme-bakery-[0-9a-f]{6}$/)
      expect(body(signup).role).toBe('owner')

      // 2. It shows up in "my workspaces".
      const mine = await app.inject({ method: 'GET', url: '/api/v1/workspaces', headers: ownerH })
      expect(body(mine).workspaces).toEqual([
        expect.objectContaining({ id: workspaceId, role: 'owner', plan: 'trial' }),
      ])

      const wsH = { ...ownerH, 'x-tenant-id': workspaceId }

      // 3. A non-member is refused.
      const stranger = await app.inject({
        method: 'GET',
        url: '/api/v1/members',
        headers: { 'x-user-email': 'nobody@x.test', 'x-tenant-id': workspaceId },
      })
      expect(stranger.statusCode).toBe(403)

      // 4. Owner invites an admin; the token is returned once.
      const invite = await app.inject({
        method: 'POST',
        url: '/api/v1/members/invites',
        headers: wsH,
        payload: { email: 'mate@acme.test', role: 'admin' },
      })
      expect(invite.statusCode).toBe(201)
      const token = body(invite).token as string
      expect(token).toHaveLength(32)

      const withInvite = await app.inject({ method: 'GET', url: '/api/v1/members', headers: wsH })
      expect(body(withInvite).members).toHaveLength(1)
      expect(body(withInvite).pendingInvites).toHaveLength(1)

      // 5. The teammate joins with their own email.
      const join = await app.inject({
        method: 'POST',
        url: '/api/v1/invites/accept',
        headers: mateH,
        payload: { token },
      })
      expect(join.statusCode).toBe(200)
      expect(body(join)).toMatchObject({ role: 'admin', workspace: { id: workspaceId } })

      // wrong email cannot use a token
      const badJoin = await app.inject({
        method: 'POST',
        url: '/api/v1/invites/accept',
        headers: { 'x-user-email': 'thief@x.test' },
        payload: { token: 'totally-made-up' },
      })
      expect(badJoin.statusCode).toBe(404)

      // 6. Two members now; find the teammate's id.
      const roster = await app.inject({ method: 'GET', url: '/api/v1/members', headers: wsH })
      const members = body(roster).members as Array<{ userId: string; email: string; role: string }>
      expect(members).toHaveLength(2)
      const mate = members.find((m) => m.email === 'mate@acme.test')!
      const owner = members.find((m) => m.email === 'owner@acme.test')!

      // 7. Owner demotes the admin to member.
      const demote = await app.inject({
        method: 'PATCH',
        url: `/api/v1/members/${mate.userId}`,
        headers: wsH,
        payload: { role: 'member' },
      })
      expect(demote.statusCode).toBe(200)

      // 8. The demoted member cannot invite.
      const memberInvite = await app.inject({
        method: 'POST',
        url: '/api/v1/members/invites',
        headers: { ...mateH, 'x-tenant-id': workspaceId },
        payload: { email: 'x@y.test', role: 'member' },
      })
      expect(memberInvite.statusCode).toBe(403)

      // 9. The last owner cannot be removed.
      const selfRemove = await app.inject({
        method: 'DELETE',
        url: `/api/v1/members/${owner.userId}`,
        headers: wsH,
      })
      expect(selfRemove.statusCode).toBe(409)

      // 10. Removing the teammate works.
      const kick = await app.inject({
        method: 'DELETE',
        url: `/api/v1/members/${mate.userId}`,
        headers: wsH,
      })
      expect(kick.statusCode).toBe(200)
      const finalRoster = await app.inject({ method: 'GET', url: '/api/v1/members', headers: wsH })
      expect(body(finalRoster).members).toHaveLength(1)
    })
  })

  it('401s sign-up and workspaces without a signed-in identity', async () => {
    await withApp(async (app) => {
      expect((await app.inject({ method: 'GET', url: '/api/v1/workspaces' })).statusCode).toBe(401)
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/v1/sign-up',
            payload: { workspaceName: 'x' },
          })
        ).statusCode,
      ).toBe(401)
    })
  })
})
