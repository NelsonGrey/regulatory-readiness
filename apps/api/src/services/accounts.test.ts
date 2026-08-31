import { beforeEach, describe, expect, it } from 'vitest'
import { createInMemoryStores, inMemoryUnitOfWork, type InMemoryStores } from '../db/uow.js'
import { AccountsService, InMemoryAccountsRepository, type Principal } from './accounts.js'

const owner: Principal = { userId: 'usr_owner', email: 'owner@acme.test', name: 'Ola Owner' }
const mate: Principal = { userId: 'usr_mate', email: 'mate@acme.test', name: 'Mac Mate' }

function setup(): {
  svc: AccountsService
  repo: InMemoryAccountsRepository
  stores: InMemoryStores
} {
  const repo = new InMemoryAccountsRepository()
  const stores = createInMemoryStores()
  return { svc: new AccountsService(repo, inMemoryUnitOfWork(stores)), repo, stores }
}

describe('AccountsService', () => {
  let ctx: ReturnType<typeof setup>
  beforeEach(() => {
    ctx = setup()
  })

  it('sign-up creates the person, the workspace, and an owner membership + audit', async () => {
    const res = await ctx.svc.signUp(owner, { workspaceName: 'Acme Ltd' })
    expect(res.role).toBe('owner')
    expect(res.tenant.slug).toMatch(/^acme-ltd-[0-9a-f]{6}$/)
    expect(ctx.repo.users).toHaveLength(1)
    expect(ctx.repo.memberships).toMatchObject([{ role: 'owner', userId: res.user.id }])
    expect(ctx.stores.audit.map((a) => a.action)).toContain('workspace.created')

    const mine = await ctx.svc.myWorkspaces(owner)
    expect(mine.map((w) => w.tenant.id)).toEqual([res.tenant.id])
  })

  it('a second sign-up with the same email reuses the person', async () => {
    const a = await ctx.svc.signUp(owner, { workspaceName: 'First' })
    const b = await ctx.svc.addWorkspace(owner, { name: 'Second' })
    expect(b.user.id).toBe(a.user.id)
    expect(ctx.repo.users).toHaveLength(1)
    expect((await ctx.svc.myWorkspaces(owner)).map((w) => w.tenant.name).sort()).toEqual([
      'First',
      'Second',
    ])
  })

  it('invite → accept adds the invited person with the invited role', async () => {
    const { tenant } = await ctx.svc.signUp(owner, { workspaceName: 'Acme' })

    const inv = await ctx.svc.invite(
      tenant.id,
      { email: owner.email, role: 'owner' },
      { email: mate.email, role: 'admin' },
    )
    if (!inv.ok) throw new Error(inv.code)
    expect(inv.acceptPath).toBe(`/join/${inv.token}`)

    const accepted = await ctx.svc.acceptInvite(mate, { token: inv.token })
    if (!accepted.ok) throw new Error(accepted.code)
    expect(accepted.role).toBe('admin')

    const members = await ctx.svc.listMembers(tenant.id)
    expect(members.map((m) => `${m.email}:${m.role}`).sort()).toEqual([
      'mate@acme.test:admin',
      'owner@acme.test:owner',
    ])
    // the invite is now spent
    expect(await ctx.svc.listPendingInvites(tenant.id)).toHaveLength(0)
    const reuse = await ctx.svc.acceptInvite(mate, { token: inv.token })
    expect(reuse).toMatchObject({ ok: false, code: 'ALREADY_USED' })
  })

  it('rejects an invite accepted by the wrong email, when expired, or when revoked', async () => {
    const { tenant } = await ctx.svc.signUp(owner, { workspaceName: 'Acme' })

    const wrong = await ctx.svc.invite(
      tenant.id,
      { email: owner.email, role: 'owner' },
      { email: 'someone@else.test', role: 'member' },
    )
    if (!wrong.ok) throw new Error(wrong.code)
    expect(await ctx.svc.acceptInvite(mate, { token: wrong.token })).toMatchObject({
      ok: false,
      code: 'EMAIL_MISMATCH',
    })

    const soon = new Date('2026-01-01T00:00:00.000Z')
    const exp = await ctx.svc.invite(
      tenant.id,
      { email: owner.email, role: 'owner' },
      { email: mate.email, role: 'member' },
      soon,
    )
    if (!exp.ok) throw new Error(exp.code)
    expect(
      await ctx.svc.acceptInvite(mate, { token: exp.token }, new Date('2026-03-01T00:00:00.000Z')),
    ).toMatchObject({ ok: false, code: 'EXPIRED' })

    const rev = await ctx.svc.invite(
      tenant.id,
      { email: owner.email, role: 'owner' },
      { email: mate.email, role: 'member' },
    )
    if (!rev.ok) throw new Error(rev.code)
    await ctx.svc.revokeInvite(tenant.id, rev.inviteId)
    expect(await ctx.svc.acceptInvite(mate, { token: rev.token })).toMatchObject({
      ok: false,
      code: 'REVOKED',
    })
  })

  it('a member cannot invite, and nobody can invite above their own rank', async () => {
    const { tenant } = await ctx.svc.signUp(owner, { workspaceName: 'Acme' })
    const inv = await ctx.svc.invite(
      tenant.id,
      { email: owner.email, role: 'owner' },
      { email: mate.email, role: 'member' },
    )
    if (!inv.ok) throw new Error(inv.code)
    await ctx.svc.acceptInvite(mate, { token: inv.token })

    expect(
      await ctx.svc.invite(
        tenant.id,
        { email: mate.email, role: 'member' },
        { email: 'x@y.test', role: 'member' },
      ),
    ).toMatchObject({ ok: false, code: 'FORBIDDEN' })
  })

  it('protects the last owner from demotion and removal', async () => {
    const { tenant, user } = await ctx.svc.signUp(owner, { workspaceName: 'Acme' })

    expect(
      await ctx.svc.changeRole(tenant.id, { email: owner.email, role: 'owner' }, user.id, 'member'),
    ).toMatchObject({ ok: false, code: 'LAST_OWNER' })
    expect(
      await ctx.svc.removeMember(
        tenant.id,
        { userId: user.id, email: owner.email, role: 'owner' },
        user.id,
      ),
    ).toMatchObject({ ok: false, code: 'LAST_OWNER' })

    // promote a second owner, then the first can step down
    const inv = await ctx.svc.invite(
      tenant.id,
      { email: owner.email, role: 'owner' },
      { email: mate.email, role: 'admin' },
    )
    if (!inv.ok) throw new Error(inv.code)
    await ctx.svc.acceptInvite(mate, { token: inv.token })
    await ctx.svc.changeRole(tenant.id, { email: owner.email, role: 'owner' }, mate.userId, 'owner')
    expect(
      await ctx.svc.changeRole(tenant.id, { email: owner.email, role: 'owner' }, user.id, 'member'),
    ).toMatchObject({ ok: true })
    expect(ctx.stores.audit.map((a) => a.action)).toContain('member.role_changed')
  })
})
