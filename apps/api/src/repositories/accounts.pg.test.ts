import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import { createPool, migrate } from '@rre/db'
import { pgUnitOfWork, type UnitOfWork } from '../db/uow.js'
import { PgAccountsRepository } from './accounts.pg.js'
import { AccountsService, type Principal } from '../services/accounts.js'

const adminUrl = process.env.TEST_DATABASE_URL
const appUrl =
  process.env.TEST_DATABASE_URL_APP ?? adminUrl?.replace(/\/\/[^:]+:[^@]+@/, '//rre_app:rre_app@')
const suite = adminUrl ? describe : describe.skip

const ola: Principal = { userId: 'usr_ola', email: 'ola@acme.test', name: 'Ola' }
const ben: Principal = { userId: 'usr_ben', email: 'ben@acme.test', name: 'Ben' }

suite('Postgres accounts / tenancy control plane (integration)', () => {
  let adminPool: Pool
  let appPool: Pool
  let repo: PgAccountsRepository
  let svc: AccountsService
  let uow: UnitOfWork

  beforeAll(async () => {
    adminPool = createPool(adminUrl as string)
    await migrate(adminPool)
    appPool = createPool(appUrl as string)
    repo = new PgAccountsRepository(appPool)
    uow = pgUnitOfWork(appPool)
    svc = new AccountsService(repo, uow)
  })

  afterEach(async () => {
    await adminPool.query('TRUNCATE app_user, tenant, membership, tenant_invite, audit_event')
  })

  afterAll(async () => {
    await appPool.end()
    await adminPool.end()
  })

  it('sign-up persists user + tenant + owner membership and joins them back', async () => {
    const res = await svc.signUp(ola, { workspaceName: 'Acme' })
    expect(res.role).toBe('owner')

    const back = await repo.findUserByEmail('OLA@acme.test') // case-insensitive
    expect(back?.id).toBe(res.user.id)
    expect(await repo.getMembership(res.tenant.id, res.user.id)).toMatchObject({ role: 'owner' })
    expect(await repo.countOwners(res.tenant.id)).toBe(1)

    const mine = await repo.listWorkspacesForUser(res.user.id)
    expect(mine).toEqual([expect.objectContaining({ role: 'owner' })])
    expect(mine[0]!.tenant.name).toBe('Acme')

    // audit row was written under the new tenant's RLS context
    const audit = await uow(res.tenant.id, (u) => u.queryAudit({ limit: 10 }))
    expect(audit.map((a) => a.action)).toContain('workspace.created')
  })

  it('membership is unique per (tenant, user)', async () => {
    const { tenant, user } = await svc.signUp(ola, { workspaceName: 'Acme' })
    await expect(
      repo.insertMembership({
        id: 'mbr_dupe',
        tenantId: tenant.id,
        userId: user.id,
        role: 'member',
        invitedBy: null,
        createdAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(/duplicate key|unique/i)
  })

  it('the control-plane tables carry no RLS (readable with no app.tenant_id set)', async () => {
    await svc.signUp(ola, { workspaceName: 'Acme' })
    const seen = await appPool.query('SELECT count(*)::int AS n FROM tenant')
    expect(seen.rows[0].n).toBe(1)
  })

  it('invite → accept persists; the invite is then excluded from pending', async () => {
    const { tenant } = await svc.signUp(ola, { workspaceName: 'Acme' })
    const inv = await svc.invite(
      tenant.id,
      { email: ola.email, role: 'owner' },
      { email: ben.email, role: 'admin' },
    )
    if (!inv.ok) throw new Error(inv.code)

    expect(await repo.listPendingInvites(tenant.id)).toHaveLength(1)

    const accepted = await svc.acceptInvite(ben, { token: inv.token })
    if (!accepted.ok) throw new Error(accepted.code)
    expect(accepted.role).toBe('admin')
    expect(await repo.listPendingInvites(tenant.id)).toHaveLength(0)

    const members = await repo.listMembers(tenant.id)
    expect(members.map((m) => `${m.email}:${m.role}`).sort()).toEqual([
      'ben@acme.test:admin',
      'ola@acme.test:owner',
    ])
  })

  it('last-owner demotion is refused against the database', async () => {
    const { tenant, user } = await svc.signUp(ola, { workspaceName: 'Acme' })
    expect(
      await svc.changeRole(tenant.id, { email: ola.email, role: 'owner' }, user.id, 'member'),
    ).toMatchObject({ ok: false, code: 'LAST_OWNER' })
    expect(await repo.getMembership(tenant.id, user.id)).toMatchObject({ role: 'owner' })
  })
})
