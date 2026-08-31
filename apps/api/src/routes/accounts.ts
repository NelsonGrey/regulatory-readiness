import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify'
import {
  AcceptInviteRequest,
  ChangeRoleRequest,
  CreateWorkspaceRequest,
  InviteMemberRequest,
  SignUpRequest,
} from '@rre/contracts'
import type { Principal } from '../auth.js'
import type { PrincipalVerifier } from '../auth/verifier.js'
import { can, type Role } from '../rbac.js'
import type { AccountsService } from '../services/accounts.js'

interface AccountRoutesOptions extends FastifyPluginOptions {
  accounts: AccountsService
  verifier: PrincipalVerifier
}

const NO_PRINCIPAL = {
  error: { code: 'NO_PRINCIPAL', message: 'a signed-in identity is required' },
}
const NO_TENANT = { error: { code: 'NO_TENANT', message: 'x-tenant-id header is required' } }

function invalidBody(reply: FastifyReply, issues: unknown): FastifyReply {
  return reply
    .code(422)
    .send({ error: { code: 'INVALID_BODY', message: 'invalid request body', details: issues } })
}

/** Workspaces, people, memberships, invites (engine TRD §3). */
export async function registerAccountRoutes(
  app: FastifyInstance,
  opts: AccountRoutesOptions,
): Promise<void> {
  const { accounts } = opts

  /** Resolve the caller's principal + their role in the `x-tenant-id` workspace. */
  async function workspaceCaller(
    req: FastifyRequest,
    reply: FastifyReply,
  ): Promise<{ principal: Principal; tenantId: string; role: Role } | null> {
    const principal = await opts.verifier.verify(req)
    if (!principal) {
      reply.code(401).send(NO_PRINCIPAL)
      return null
    }
    const tenantId = req.headers['x-tenant-id']
    if (typeof tenantId !== 'string' || tenantId.length === 0) {
      reply.code(401).send(NO_TENANT)
      return null
    }
    const role = await accounts.membershipRole(tenantId, principal.email)
    if (!role) {
      reply.code(403).send({
        error: { code: 'NOT_A_MEMBER', message: 'you are not a member of this workspace' },
      })
      return null
    }
    return { principal, tenantId, role }
  }

  app.post('/sign-up', async (req, reply) => {
    const principal = await opts.verifier.verify(req)
    if (!principal) return reply.code(401).send(NO_PRINCIPAL)
    const parsed = SignUpRequest.safeParse(req.body)
    if (!parsed.success) return invalidBody(reply, parsed.error.issues)
    const res = await accounts.signUp(principal, parsed.data)
    return reply.code(201).send({ workspace: res.tenant, role: res.role })
  })

  app.get('/workspaces', async (req, reply) => {
    const principal = await opts.verifier.verify(req)
    if (!principal) return reply.code(401).send(NO_PRINCIPAL)
    const rows = await accounts.myWorkspaces(principal)
    return {
      workspaces: rows.map((w) => ({
        id: w.tenant.id,
        name: w.tenant.name,
        slug: w.tenant.slug,
        plan: w.tenant.plan,
        role: w.role,
      })),
    }
  })

  app.post('/workspaces', async (req, reply) => {
    const principal = await opts.verifier.verify(req)
    if (!principal) return reply.code(401).send(NO_PRINCIPAL)
    const parsed = CreateWorkspaceRequest.safeParse(req.body)
    if (!parsed.success) return invalidBody(reply, parsed.error.issues)
    const res = await accounts.addWorkspace(principal, parsed.data)
    return reply.code(201).send({ workspace: res.tenant, role: res.role })
  })

  app.post('/invites/accept', async (req, reply) => {
    const principal = await opts.verifier.verify(req)
    if (!principal) return reply.code(401).send(NO_PRINCIPAL)
    const parsed = AcceptInviteRequest.safeParse(req.body)
    if (!parsed.success) return invalidBody(reply, parsed.error.issues)
    const res = await accounts.acceptInvite(principal, parsed.data)
    if (!res.ok) {
      const code = res.code === 'INVALID_TOKEN' ? 404 : 409
      return reply.code(code).send({ error: { code: res.code, message: res.message } })
    }
    return { workspace: res.tenant, role: res.role }
  })

  app.get('/members', async (req, reply) => {
    const caller = await workspaceCaller(req, reply)
    if (!caller) return reply
    const [members, invites] = await Promise.all([
      accounts.listMembers(caller.tenantId),
      can(caller.role, 'manage_members')
        ? accounts.listPendingInvites(caller.tenantId)
        : Promise.resolve([]),
    ])
    return {
      members,
      pendingInvites: invites.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
      })),
    }
  })

  app.post('/members/invites', async (req, reply) => {
    const caller = await workspaceCaller(req, reply)
    if (!caller) return reply
    const parsed = InviteMemberRequest.safeParse(req.body)
    if (!parsed.success) return invalidBody(reply, parsed.error.issues)
    const res = await accounts.invite(
      caller.tenantId,
      { email: caller.principal.email, role: caller.role },
      parsed.data,
    )
    if (!res.ok) {
      const code = res.code === 'FORBIDDEN' ? 403 : 409
      return reply.code(code).send({ error: { code: res.code, message: res.message } })
    }
    return reply.code(201).send({
      inviteId: res.inviteId,
      token: res.token,
      acceptPath: res.acceptPath,
      expiresAt: res.expiresAt,
    })
  })

  app.post('/members/invites/:id/revoke', async (req, reply) => {
    const caller = await workspaceCaller(req, reply)
    if (!caller) return reply
    if (!can(caller.role, 'manage_members')) {
      return reply
        .code(403)
        .send({ error: { code: 'FORBIDDEN', message: 'you cannot manage members' } })
    }
    const { id } = req.params as { id: string }
    await accounts.revokeInvite(caller.tenantId, id)
    return { ok: true }
  })

  app.patch('/members/:userId', async (req, reply) => {
    const caller = await workspaceCaller(req, reply)
    if (!caller) return reply
    const parsed = ChangeRoleRequest.safeParse(req.body)
    if (!parsed.success) return invalidBody(reply, parsed.error.issues)
    const { userId } = req.params as { userId: string }
    const res = await accounts.changeRole(
      caller.tenantId,
      { email: caller.principal.email, role: caller.role },
      userId,
      parsed.data.role,
    )
    if (!res.ok) {
      const code = res.code === 'NOT_A_MEMBER' ? 404 : res.code === 'LAST_OWNER' ? 409 : 403
      return reply.code(code).send({ error: { code: res.code, message: res.message } })
    }
    return { ok: true }
  })

  app.delete('/members/:userId', async (req, reply) => {
    const caller = await workspaceCaller(req, reply)
    if (!caller) return reply
    const { userId } = req.params as { userId: string }
    const res = await accounts.removeMember(
      caller.tenantId,
      { userId: caller.principal.userId, email: caller.principal.email, role: caller.role },
      userId,
    )
    if (!res.ok) {
      const code = res.code === 'NOT_A_MEMBER' ? 404 : res.code === 'LAST_OWNER' ? 409 : 403
      return reply.code(code).send({ error: { code: res.code, message: res.message } })
    }
    return { ok: true }
  })
}
