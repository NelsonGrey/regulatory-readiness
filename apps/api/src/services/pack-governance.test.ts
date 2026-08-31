import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { PackRegistry } from '../pack-registry.js'
import { InMemoryPackGovernanceRepository, PackGovernanceService } from './pack-governance.js'

const PACKS_DIR = fileURLToPath(new URL('../../../../packs', import.meta.url))
const PACK = 'eaa-accessibility'

async function setup(): Promise<{
  svc: PackGovernanceService
  repo: InMemoryPackGovernanceRepository
  checksum: string
}> {
  const registry = await PackRegistry.load(PACKS_DIR)
  const repo = new InMemoryPackGovernanceRepository()
  return {
    svc: new PackGovernanceService(repo, registry),
    repo,
    checksum: registry.get(PACK)!.computedChecksum,
  }
}

describe('PackGovernanceService', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => {
    ctx = await setup()
  })

  it('overview reports both packs as draft with no reviews', async () => {
    const overview = await ctx.svc.overview()
    expect(overview.map((o) => o.packKey).sort()).toEqual([
      'eaa-accessibility',
      'eu-battery-passport',
    ])
    const eaa = overview.find((o) => o.packKey === PACK)!
    expect(eaa.effectiveStatus).toBe('draft')
    expect(eaa.distinctReviewers).toBe(0)
    expect(eaa.canActivate).toBe(false)
    expect(eaa.blockers).toContain('NEEDS_REVIEWS (0/2)')
  })

  it('needs two distinct reviewers on the current checksum to activate', async () => {
    expect(await ctx.svc.activate(PACK, 'ops@rre.test')).toMatchObject({
      ok: false,
      code: 'NEEDS_REVIEWS',
    })

    await ctx.svc.review(PACK, 'ann@rre.test', 'looks right')
    await ctx.svc.review(PACK, 'ann@rre.test', 'again') // same person, still 1 distinct
    expect(await ctx.svc.activate(PACK, 'ops@rre.test')).toMatchObject({ code: 'NEEDS_REVIEWS' })

    await ctx.svc.review(PACK, 'ben@rre.test', null)
    const done = await ctx.svc.activate(PACK, 'ops@rre.test')
    expect(done).toMatchObject({ ok: true, checksum: ctx.checksum })
    expect(await ctx.svc.effectiveStatus(PACK)).toBe('active')

    const eaa = (await ctx.svc.overview()).find((o) => o.packKey === PACK)!
    expect(eaa.effectiveStatus).toBe('active')
    expect(eaa.activation).toMatchObject({ status: 'active', activatedBy: 'ops@rre.test' })
    expect(eaa.canActivate).toBe(false)
  })

  it('withdrawing returns the pack to its on-disk status', async () => {
    await ctx.svc.review(PACK, 'ann@rre.test', null)
    await ctx.svc.review(PACK, 'ben@rre.test', null)
    await ctx.svc.activate(PACK, 'ops@rre.test')
    expect(await ctx.svc.effectiveStatus(PACK)).toBe('active')

    expect(await ctx.svc.withdraw(PACK, 'ops@rre.test')).toEqual({ ok: true })
    expect(await ctx.svc.effectiveStatus(PACK)).toBe('draft')
    expect(await ctx.svc.withdraw(PACK, 'ops@rre.test')).toMatchObject({ code: 'NOT_ACTIVE' })
  })

  it('an activation against a stale checksum does not take effect and is flagged as drift', async () => {
    await ctx.repo.upsertActivation({
      packKey: PACK,
      checksum: 'sha256:stale',
      status: 'active',
      activatedBy: 'ops@rre.test',
      activatedAt: new Date().toISOString(),
      withdrawnBy: null,
      withdrawnAt: null,
    })
    expect(await ctx.svc.effectiveStatus(PACK)).toBe('draft')
    const eaa = (await ctx.svc.overview()).find((o) => o.packKey === PACK)!
    expect(eaa.driftedSinceActivation).toBe(true)
    expect(eaa.effectiveStatus).toBe('draft')
  })

  it('rejects review / activate for an unknown pack', async () => {
    expect(await ctx.svc.review('no-such-pack', 'x@y.test', null)).toMatchObject({
      ok: false,
      code: 'PACK_NOT_FOUND',
    })
    expect(await ctx.svc.activate('no-such-pack', 'x@y.test')).toMatchObject({
      code: 'PACK_NOT_FOUND',
    })
  })
})
