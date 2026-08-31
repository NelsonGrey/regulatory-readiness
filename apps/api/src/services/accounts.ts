import { randomUUID } from 'node:crypto'
import type { UnitOfWork } from '../db/uow.js'
import { issueToken, hashToken } from '../tokens.js'
import { can, roleAtLeast, type Role } from '../rbac.js'

export interface UserRecord {
  id: string
  email: string
  name: string | null
  locale: string
  createdAt: string
  lastSeenAt: string | null
}

export interface TenantRecord {
  id: string
  name: string
  slug: string
  plan: 'trial' | 'starter' | 'growth' | 'suspended'
  locale: string
  createdBy: string
  createdAt: string
}

export interface MembershipRecord {
  id: string
  tenantId: string
  userId: string
  role: Role
  invitedBy: string | null
  createdAt: string
}

export interface InviteRecord {
  id: string
  tenantId: string
  email: string
  role: Role
  tokenPrefix: string
  tokenHash: string
  expiresAt: string
  acceptedAt: string | null
  acceptedUserId: string | null
  revokedAt: string | null
  createdBy: string
  createdAt: string
}

export interface WorkspaceMembership {
  tenant: TenantRecord
  role: Role
}

export interface MemberView {
  userId: string
  email: string
  name: string | null
  role: Role
  createdAt: string
}

/**
 * The tenancy control plane. No RLS — every method is explicitly scoped by
 * tenant id or user id (see migration 0016). The pg impl runs on a plain pool;
 * the in-memory impl backs tests and the default `buildApp`.
 */
export interface AccountsRepository {
  findUserByEmail(email: string): Promise<UserRecord | null>
  getUser(id: string): Promise<UserRecord | null>
  insertUser(u: UserRecord): Promise<void>

  insertTenant(t: TenantRecord): Promise<void>
  getTenant(id: string): Promise<TenantRecord | null>
  slugExists(slug: string): Promise<boolean>

  insertMembership(m: MembershipRecord): Promise<void>
  getMembership(tenantId: string, userId: string): Promise<MembershipRecord | null>
  listWorkspacesForUser(userId: string): Promise<WorkspaceMembership[]>
  listMembers(tenantId: string): Promise<MemberView[]>
  countOwners(tenantId: string): Promise<number>
  updateRole(tenantId: string, userId: string, role: Role): Promise<void>
  deleteMembership(tenantId: string, userId: string): Promise<void>

  insertInvite(i: InviteRecord): Promise<void>
  findInviteByHash(hash: string): Promise<InviteRecord | null>
  listPendingInvites(tenantId: string): Promise<InviteRecord[]>
  markInviteAccepted(id: string, userId: string, at: string): Promise<void>
  revokeInvite(tenantId: string, id: string): Promise<void>
}

export interface Principal {
  userId: string
  email: string
  name?: string | null
}

type Fail<C extends string> = { ok: false; code: C; message: string }

export interface WorkspaceCreated {
  user: UserRecord
  tenant: TenantRecord
  role: Role
}

export type InviteResult =
  | { ok: true; inviteId: string; token: string; acceptPath: string; expiresAt: string }
  | Fail<'FORBIDDEN' | 'ALREADY_MEMBER'>

export type AcceptResult =
  | { ok: true; tenant: TenantRecord; role: Role }
  | Fail<'INVALID_TOKEN' | 'EXPIRED' | 'ALREADY_USED' | 'EMAIL_MISMATCH' | 'REVOKED'>

export type RoleChangeResult =
  { ok: true } | Fail<'FORBIDDEN' | 'NOT_A_MEMBER' | 'LAST_OWNER' | 'ROLE_ABOVE_SELF'>

export type RemoveResult = { ok: true } | Fail<'FORBIDDEN' | 'NOT_A_MEMBER' | 'LAST_OWNER'>

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${base || 'workspace'}-${randomUUID().slice(0, 6)}`
}

export class AccountsService {
  constructor(
    private readonly accounts: AccountsRepository,
    private readonly uow: UnitOfWork,
  ) {}

  private async findOrCreateUser(principal: Principal, now: Date): Promise<UserRecord> {
    const existing = await this.accounts.findUserByEmail(principal.email)
    if (existing) return existing
    const user: UserRecord = {
      id: principal.userId || `usr_${randomUUID()}`,
      email: principal.email,
      name: principal.name ?? null,
      locale: 'en',
      createdAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
    }
    await this.accounts.insertUser(user)
    return user
  }

  private async createWorkspace(
    user: UserRecord,
    name: string,
    now: Date,
  ): Promise<{ tenant: TenantRecord; membership: MembershipRecord }> {
    let slug = slugify(name)
    for (let i = 0; i < 3 && (await this.accounts.slugExists(slug)); i++) slug = slugify(name)
    const tenant: TenantRecord = {
      id: `wsp_${randomUUID()}`,
      name,
      slug,
      plan: 'trial',
      locale: 'en',
      createdBy: user.id,
      createdAt: now.toISOString(),
    }
    await this.accounts.insertTenant(tenant)
    const membership: MembershipRecord = {
      id: `mbr_${randomUUID()}`,
      tenantId: tenant.id,
      userId: user.id,
      role: 'owner',
      invitedBy: null,
      createdAt: now.toISOString(),
    }
    await this.accounts.insertMembership(membership)
    await this.uow(tenant.id, (u) =>
      u.audit({
        actorType: 'user',
        actorId: user.email,
        action: 'workspace.created',
        targetType: 'tenant',
        targetId: tenant.id,
        occurredAt: now.toISOString(),
        metadata: { slug: tenant.slug },
      }),
    )
    return { tenant, membership }
  }

  async signUp(
    principal: Principal,
    input: { workspaceName: string; name?: string },
    now: Date = new Date(),
  ): Promise<WorkspaceCreated> {
    const user = await this.findOrCreateUser(
      { ...principal, name: input.name ?? principal.name },
      now,
    )
    const { tenant } = await this.createWorkspace(user, input.workspaceName, now)
    return { user, tenant, role: 'owner' }
  }

  async addWorkspace(
    principal: Principal,
    input: { name: string },
    now: Date = new Date(),
  ): Promise<WorkspaceCreated> {
    const user = await this.findOrCreateUser(principal, now)
    const { tenant } = await this.createWorkspace(user, input.name, now)
    return { user, tenant, role: 'owner' }
  }

  async myWorkspaces(principal: Principal): Promise<WorkspaceMembership[]> {
    const user = await this.accounts.findUserByEmail(principal.email)
    if (!user) return []
    return this.accounts.listWorkspacesForUser(user.id)
  }

  /** The role a person holds in a workspace, or null if they are not a member. */
  async membershipRole(tenantId: string, email: string): Promise<Role | null> {
    const user = await this.accounts.findUserByEmail(email)
    if (!user) return null
    const m = await this.accounts.getMembership(tenantId, user.id)
    return m?.role ?? null
  }

  async listMembers(tenantId: string): Promise<MemberView[]> {
    return this.accounts.listMembers(tenantId)
  }

  async listPendingInvites(tenantId: string): Promise<InviteRecord[]> {
    return this.accounts.listPendingInvites(tenantId)
  }

  async invite(
    tenantId: string,
    actor: { email: string; role: Role },
    input: { email: string; role: 'admin' | 'member' },
    now: Date = new Date(),
  ): Promise<InviteResult> {
    if (!can(actor.role, 'manage_members') || !roleAtLeast(actor.role, input.role)) {
      return { ok: false, code: 'FORBIDDEN', message: 'you cannot invite at this role' }
    }
    const invitee = await this.accounts.findUserByEmail(input.email)
    if (invitee && (await this.accounts.getMembership(tenantId, invitee.id))) {
      return { ok: false, code: 'ALREADY_MEMBER', message: 'that person is already a member' }
    }
    const issued = issueToken()
    const invite: InviteRecord = {
      id: `inv_${randomUUID()}`,
      tenantId,
      email: input.email,
      role: input.role,
      tokenPrefix: issued.prefix,
      tokenHash: issued.hash,
      expiresAt: new Date(now.getTime() + INVITE_TTL_MS).toISOString(),
      acceptedAt: null,
      acceptedUserId: null,
      revokedAt: null,
      createdBy: actor.email,
      createdAt: now.toISOString(),
    }
    await this.accounts.insertInvite(invite)
    await this.uow(tenantId, (u) =>
      u.audit({
        actorType: 'user',
        actorId: actor.email,
        action: 'member.invited',
        targetType: 'tenant_invite',
        targetId: invite.id,
        occurredAt: now.toISOString(),
        metadata: { role: input.role },
      }),
    )
    return {
      ok: true,
      inviteId: invite.id,
      token: issued.token,
      acceptPath: `/join/${issued.token}`,
      expiresAt: invite.expiresAt,
    }
  }

  async revokeInvite(tenantId: string, inviteId: string): Promise<{ ok: true }> {
    await this.accounts.revokeInvite(tenantId, inviteId)
    return { ok: true }
  }

  async acceptInvite(
    principal: Principal,
    input: { token: string; name?: string },
    now: Date = new Date(),
  ): Promise<AcceptResult> {
    const invite = await this.accounts.findInviteByHash(hashToken(input.token))
    if (!invite) return { ok: false, code: 'INVALID_TOKEN', message: 'unknown or invalid invite' }
    if (invite.revokedAt)
      return { ok: false, code: 'REVOKED', message: 'this invite was withdrawn' }
    if (invite.acceptedAt)
      return { ok: false, code: 'ALREADY_USED', message: 'this invite was already used' }
    if (Date.parse(invite.expiresAt) <= now.getTime())
      return { ok: false, code: 'EXPIRED', message: 'this invite has expired' }
    if (invite.email.toLowerCase() !== principal.email.toLowerCase())
      return { ok: false, code: 'EMAIL_MISMATCH', message: 'this invite is for a different email' }

    const tenant = await this.accounts.getTenant(invite.tenantId)
    if (!tenant)
      return { ok: false, code: 'INVALID_TOKEN', message: 'the workspace no longer exists' }

    const user = await this.findOrCreateUser(
      { ...principal, name: input.name ?? principal.name },
      now,
    )
    const already = await this.accounts.getMembership(invite.tenantId, user.id)
    if (!already) {
      await this.accounts.insertMembership({
        id: `mbr_${randomUUID()}`,
        tenantId: invite.tenantId,
        userId: user.id,
        role: invite.role,
        invitedBy: invite.createdBy,
        createdAt: now.toISOString(),
      })
    }
    await this.accounts.markInviteAccepted(invite.id, user.id, now.toISOString())
    await this.uow(invite.tenantId, (u) =>
      u.audit({
        actorType: 'user',
        actorId: user.email,
        action: 'member.joined',
        targetType: 'membership',
        targetId: user.id,
        occurredAt: now.toISOString(),
        metadata: { role: invite.role, inviteId: invite.id },
      }),
    )
    return { ok: true, tenant, role: already?.role ?? invite.role }
  }

  async changeRole(
    tenantId: string,
    actor: { email: string; role: Role },
    targetUserId: string,
    role: Role,
    now: Date = new Date(),
  ): Promise<RoleChangeResult> {
    if (!can(actor.role, 'manage_members'))
      return { ok: false, code: 'FORBIDDEN', message: 'you cannot manage members' }
    if (!roleAtLeast(actor.role, role))
      return {
        ok: false,
        code: 'ROLE_ABOVE_SELF',
        message: 'you cannot grant a role above your own',
      }
    const target = await this.accounts.getMembership(tenantId, targetUserId)
    if (!target)
      return { ok: false, code: 'NOT_A_MEMBER', message: 'not a member of this workspace' }
    if (
      target.role === 'owner' &&
      role !== 'owner' &&
      (await this.accounts.countOwners(tenantId)) <= 1
    )
      return { ok: false, code: 'LAST_OWNER', message: 'a workspace must keep at least one owner' }
    if (target.role === role) return { ok: true }
    await this.accounts.updateRole(tenantId, targetUserId, role)
    await this.uow(tenantId, (u) =>
      u.audit({
        actorType: 'user',
        actorId: actor.email,
        action: 'member.role_changed',
        targetType: 'membership',
        targetId: targetUserId,
        occurredAt: now.toISOString(),
        metadata: { from: target.role, to: role },
      }),
    )
    return { ok: true }
  }

  async removeMember(
    tenantId: string,
    actor: { userId: string; email: string; role: Role },
    targetUserId: string,
    now: Date = new Date(),
  ): Promise<RemoveResult> {
    const isSelf = actor.userId === targetUserId
    if (!isSelf && !can(actor.role, 'manage_members'))
      return { ok: false, code: 'FORBIDDEN', message: 'you cannot remove other members' }
    const target = await this.accounts.getMembership(tenantId, targetUserId)
    if (!target)
      return { ok: false, code: 'NOT_A_MEMBER', message: 'not a member of this workspace' }
    if (target.role === 'owner' && (await this.accounts.countOwners(tenantId)) <= 1)
      return { ok: false, code: 'LAST_OWNER', message: 'a workspace must keep at least one owner' }
    await this.accounts.deleteMembership(tenantId, targetUserId)
    await this.uow(tenantId, (u) =>
      u.audit({
        actorType: 'user',
        actorId: actor.email,
        action: isSelf ? 'member.left' : 'member.removed',
        targetType: 'membership',
        targetId: targetUserId,
        occurredAt: now.toISOString(),
      }),
    )
    return { ok: true }
  }
}

// --- In-memory repository ------------------------------------------------------

export class InMemoryAccountsRepository implements AccountsRepository {
  readonly users: UserRecord[] = []
  readonly tenants: TenantRecord[] = []
  readonly memberships: MembershipRecord[] = []
  readonly invites: InviteRecord[] = []

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    return this.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null
  }
  async getUser(id: string): Promise<UserRecord | null> {
    return this.users.find((u) => u.id === id) ?? null
  }
  async insertUser(u: UserRecord): Promise<void> {
    this.users.push({ ...u })
  }
  async insertTenant(t: TenantRecord): Promise<void> {
    this.tenants.push({ ...t })
  }
  async getTenant(id: string): Promise<TenantRecord | null> {
    return this.tenants.find((t) => t.id === id) ?? null
  }
  async slugExists(slug: string): Promise<boolean> {
    return this.tenants.some((t) => t.slug === slug)
  }
  async insertMembership(m: MembershipRecord): Promise<void> {
    this.memberships.push({ ...m })
  }
  async getMembership(tenantId: string, userId: string): Promise<MembershipRecord | null> {
    return this.memberships.find((m) => m.tenantId === tenantId && m.userId === userId) ?? null
  }
  async listWorkspacesForUser(userId: string): Promise<WorkspaceMembership[]> {
    return this.memberships
      .filter((m) => m.userId === userId)
      .map((m) => ({ tenant: this.tenants.find((t) => t.id === m.tenantId)!, role: m.role }))
      .filter((w) => w.tenant)
      .sort((a, b) => (a.tenant.createdAt < b.tenant.createdAt ? -1 : 1))
  }
  async listMembers(tenantId: string): Promise<MemberView[]> {
    return this.memberships
      .filter((m) => m.tenantId === tenantId)
      .map((m) => {
        const u = this.users.find((x) => x.id === m.userId)
        return {
          userId: m.userId,
          email: u?.email ?? '',
          name: u?.name ?? null,
          role: m.role,
          createdAt: m.createdAt,
        }
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  }
  async countOwners(tenantId: string): Promise<number> {
    return this.memberships.filter((m) => m.tenantId === tenantId && m.role === 'owner').length
  }
  async updateRole(tenantId: string, userId: string, role: Role): Promise<void> {
    const m = this.memberships.find((x) => x.tenantId === tenantId && x.userId === userId)
    if (m) m.role = role
  }
  async deleteMembership(tenantId: string, userId: string): Promise<void> {
    const i = this.memberships.findIndex((x) => x.tenantId === tenantId && x.userId === userId)
    if (i >= 0) this.memberships.splice(i, 1)
  }
  async insertInvite(i: InviteRecord): Promise<void> {
    this.invites.push({ ...i })
  }
  async findInviteByHash(hash: string): Promise<InviteRecord | null> {
    return this.invites.find((i) => i.tokenHash === hash) ?? null
  }
  async listPendingInvites(tenantId: string): Promise<InviteRecord[]> {
    return this.invites
      .filter((i) => i.tenantId === tenantId && !i.acceptedAt && !i.revokedAt)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }
  async markInviteAccepted(id: string, userId: string, at: string): Promise<void> {
    const i = this.invites.find((x) => x.id === id)
    if (i) {
      i.acceptedAt = at
      i.acceptedUserId = userId
    }
  }
  async revokeInvite(tenantId: string, id: string): Promise<void> {
    const i = this.invites.find((x) => x.id === id && x.tenantId === tenantId)
    if (i && !i.revokedAt) i.revokedAt = new Date().toISOString()
  }
}
