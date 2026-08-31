import type { Pool } from 'pg'
import type { Role } from '../rbac.js'
import type {
  AccountsRepository,
  InviteRecord,
  MemberView,
  MembershipRecord,
  TenantRecord,
  UserRecord,
  WorkspaceMembership,
} from '../services/accounts.js'

interface UserRow {
  id: string
  email: string
  name: string | null
  locale: string
  created_at: Date
  last_seen_at: Date | null
}
interface TenantRow {
  id: string
  name: string
  slug: string
  plan: TenantRecord['plan']
  locale: string
  created_by: string
  created_at: Date
}
interface MembershipRow {
  id: string
  tenant_id: string
  user_id: string
  role: Role
  invited_by: string | null
  created_at: Date
}
interface InviteRow {
  id: string
  tenant_id: string
  email: string
  role: Role
  token_prefix: string
  token_hash: string
  expires_at: Date
  accepted_at: Date | null
  accepted_user_id: string | null
  revoked_at: Date | null
  created_by: string
  created_at: Date
}

const toUser = (r: UserRow): UserRecord => ({
  id: r.id,
  email: r.email,
  name: r.name,
  locale: r.locale,
  createdAt: r.created_at.toISOString(),
  lastSeenAt: r.last_seen_at ? r.last_seen_at.toISOString() : null,
})
const toTenant = (r: TenantRow): TenantRecord => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  plan: r.plan,
  locale: r.locale,
  createdBy: r.created_by,
  createdAt: r.created_at.toISOString(),
})
const toMembership = (r: MembershipRow): MembershipRecord => ({
  id: r.id,
  tenantId: r.tenant_id,
  userId: r.user_id,
  role: r.role,
  invitedBy: r.invited_by,
  createdAt: r.created_at.toISOString(),
})
const toInvite = (r: InviteRow): InviteRecord => ({
  id: r.id,
  tenantId: r.tenant_id,
  email: r.email,
  role: r.role,
  tokenPrefix: r.token_prefix,
  tokenHash: r.token_hash,
  expiresAt: r.expires_at.toISOString(),
  acceptedAt: r.accepted_at ? r.accepted_at.toISOString() : null,
  acceptedUserId: r.accepted_user_id,
  revokedAt: r.revoked_at ? r.revoked_at.toISOString() : null,
  createdBy: r.created_by,
  createdAt: r.created_at.toISOString(),
})

/** The tenancy control plane on a plain pool — no RLS, scoped by argument. */
export class PgAccountsRepository implements AccountsRepository {
  constructor(private readonly pool: Pool) {}

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const r = await this.pool.query<UserRow>(
      `SELECT * FROM app_user WHERE lower(email) = lower($1)`,
      [email],
    )
    return r.rows[0] ? toUser(r.rows[0]) : null
  }
  async getUser(id: string): Promise<UserRecord | null> {
    const r = await this.pool.query<UserRow>(`SELECT * FROM app_user WHERE id = $1`, [id])
    return r.rows[0] ? toUser(r.rows[0]) : null
  }
  async insertUser(u: UserRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO app_user (id, email, name, locale, created_at, last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [u.id, u.email, u.name, u.locale, u.createdAt, u.lastSeenAt],
    )
  }

  async insertTenant(t: TenantRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO tenant (id, name, slug, plan, locale, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [t.id, t.name, t.slug, t.plan, t.locale, t.createdBy, t.createdAt],
    )
  }
  async getTenant(id: string): Promise<TenantRecord | null> {
    const r = await this.pool.query<TenantRow>(`SELECT * FROM tenant WHERE id = $1`, [id])
    return r.rows[0] ? toTenant(r.rows[0]) : null
  }
  async slugExists(slug: string): Promise<boolean> {
    const r = await this.pool.query(`SELECT 1 FROM tenant WHERE slug = $1`, [slug])
    return r.rowCount === 1
  }

  async insertMembership(m: MembershipRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO membership (id, tenant_id, user_id, role, invited_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [m.id, m.tenantId, m.userId, m.role, m.invitedBy, m.createdAt],
    )
  }
  async getMembership(tenantId: string, userId: string): Promise<MembershipRecord | null> {
    const r = await this.pool.query<MembershipRow>(
      `SELECT * FROM membership WHERE tenant_id = $1 AND user_id = $2`,
      [tenantId, userId],
    )
    return r.rows[0] ? toMembership(r.rows[0]) : null
  }
  async listWorkspacesForUser(userId: string): Promise<WorkspaceMembership[]> {
    const r = await this.pool.query<TenantRow & { role: Role }>(
      `SELECT t.*, m.role
         FROM membership m JOIN tenant t ON t.id = m.tenant_id
        WHERE m.user_id = $1
        ORDER BY t.created_at ASC`,
      [userId],
    )
    return r.rows.map((row) => ({ tenant: toTenant(row), role: row.role }))
  }
  async listMembers(tenantId: string): Promise<MemberView[]> {
    const r = await this.pool.query<{
      user_id: string
      email: string
      name: string | null
      role: Role
      created_at: Date
    }>(
      `SELECT m.user_id, u.email, u.name, m.role, m.created_at
         FROM membership m JOIN app_user u ON u.id = m.user_id
        WHERE m.tenant_id = $1
        ORDER BY m.created_at ASC`,
      [tenantId],
    )
    return r.rows.map((row) => ({
      userId: row.user_id,
      email: row.email,
      name: row.name,
      role: row.role,
      createdAt: row.created_at.toISOString(),
    }))
  }
  async countOwners(tenantId: string): Promise<number> {
    const r = await this.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM membership WHERE tenant_id = $1 AND role = 'owner'`,
      [tenantId],
    )
    return Number(r.rows[0]?.n ?? 0)
  }
  async updateRole(tenantId: string, userId: string, role: Role): Promise<void> {
    await this.pool.query(`UPDATE membership SET role = $1 WHERE tenant_id = $2 AND user_id = $3`, [
      role,
      tenantId,
      userId,
    ])
  }
  async deleteMembership(tenantId: string, userId: string): Promise<void> {
    await this.pool.query(`DELETE FROM membership WHERE tenant_id = $1 AND user_id = $2`, [
      tenantId,
      userId,
    ])
  }

  async insertInvite(i: InviteRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO tenant_invite
         (id, tenant_id, email, role, token_prefix, token_hash, expires_at,
          accepted_at, accepted_user_id, revoked_at, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        i.id,
        i.tenantId,
        i.email,
        i.role,
        i.tokenPrefix,
        i.tokenHash,
        i.expiresAt,
        i.acceptedAt,
        i.acceptedUserId,
        i.revokedAt,
        i.createdBy,
        i.createdAt,
      ],
    )
  }
  async findInviteByHash(hash: string): Promise<InviteRecord | null> {
    const r = await this.pool.query<InviteRow>(
      `SELECT * FROM tenant_invite WHERE token_hash = $1`,
      [hash],
    )
    return r.rows[0] ? toInvite(r.rows[0]) : null
  }
  async listPendingInvites(tenantId: string): Promise<InviteRecord[]> {
    const r = await this.pool.query<InviteRow>(
      `SELECT * FROM tenant_invite
        WHERE tenant_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL
        ORDER BY created_at DESC`,
      [tenantId],
    )
    return r.rows.map(toInvite)
  }
  async markInviteAccepted(id: string, userId: string, at: string): Promise<void> {
    await this.pool.query(
      `UPDATE tenant_invite SET accepted_at = $1, accepted_user_id = $2 WHERE id = $3`,
      [at, userId, id],
    )
  }
  async revokeInvite(tenantId: string, id: string): Promise<void> {
    await this.pool.query(
      `UPDATE tenant_invite SET revoked_at = now()
        WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL`,
      [id, tenantId],
    )
  }
}
