import { randomUUID } from 'node:crypto'
import type { PackValidationIssue } from '@rre/control-catalog'
import type { PackRegistry } from '../pack-registry.js'

export interface PackReviewRecord {
  id: string
  packKey: string
  checksum: string
  reviewer: string
  note: string | null
  createdAt: string
}

export interface PackActivationRecord {
  packKey: string
  checksum: string
  status: 'active' | 'withdrawn'
  activatedBy: string
  activatedAt: string
  withdrawnBy: string | null
  withdrawnAt: string | null
}

export interface PackGovernanceRepository {
  /** Idempotent on (packKey, checksum, reviewer). */
  addReview(r: PackReviewRecord): Promise<void>
  listReviews(packKey: string, checksum: string): Promise<PackReviewRecord[]>
  getActivation(packKey: string): Promise<PackActivationRecord | null>
  upsertActivation(a: PackActivationRecord): Promise<void>
}

export interface PackOverview {
  packKey: string
  title: string | null
  onDiskStatus: string | null
  computedChecksum: string
  valid: boolean
  issues: PackValidationIssue[]
  reviews: Array<{ reviewer: string; note: string | null; at: string }>
  distinctReviewers: number
  activation: PackActivationRecord | null
  effectiveStatus: string
  driftedSinceActivation: boolean
  canActivate: boolean
  blockers: string[]
}

type Fail<C extends string> = { ok: false; code: C; message: string }

const MIN_REVIEWERS = 2

export class PackGovernanceService {
  constructor(
    private readonly repo: PackGovernanceRepository,
    private readonly registry: PackRegistry,
  ) {}

  /** The status the rest of the app should treat the pack as having. */
  async effectiveStatus(packKey: string): Promise<string> {
    const p = this.registry.get(packKey)
    if (!p?.manifest) return 'unknown'
    const act = await this.repo.getActivation(packKey)
    if (act && act.status === 'active' && act.checksum === p.computedChecksum) return 'active'
    return p.manifest.status
  }

  async overview(): Promise<PackOverview[]> {
    const out: PackOverview[] = []
    for (const p of this.registry.list()) {
      const reviews = await this.repo.listReviews(p.packKey, p.computedChecksum)
      const activation = await this.repo.getActivation(p.packKey)
      const distinctReviewers = new Set(reviews.map((r) => r.reviewer)).size
      const drifted =
        !!activation && activation.status === 'active' && activation.checksum !== p.computedChecksum
      const activeNow = activation?.status === 'active' && !drifted
      const blockers: string[] = []
      if (!p.valid) blockers.push('PACK_INVALID')
      if (distinctReviewers < MIN_REVIEWERS)
        blockers.push(`NEEDS_REVIEWS (${distinctReviewers}/${MIN_REVIEWERS})`)
      out.push({
        packKey: p.packKey,
        title: p.manifest?.title ?? null,
        onDiskStatus: p.manifest?.status ?? null,
        computedChecksum: p.computedChecksum,
        valid: p.valid,
        issues: p.issues,
        reviews: reviews
          .map((r) => ({ reviewer: r.reviewer, note: r.note, at: r.createdAt }))
          .sort((a, b) => (a.at < b.at ? -1 : 1)),
        distinctReviewers,
        activation,
        effectiveStatus: activeNow ? 'active' : (p.manifest?.status ?? 'unknown'),
        driftedSinceActivation: drifted,
        canActivate: blockers.length === 0 && !activeNow,
        blockers,
      })
    }
    return out
  }

  async review(
    packKey: string,
    reviewer: string,
    note: string | null,
    now: Date = new Date(),
  ): Promise<{ ok: true; distinctReviewers: number } | Fail<'PACK_NOT_FOUND'>> {
    const p = this.registry.get(packKey)
    if (!p?.manifest) return { ok: false, code: 'PACK_NOT_FOUND', message: `no pack "${packKey}"` }
    await this.repo.addReview({
      id: `prv_${randomUUID()}`,
      packKey,
      checksum: p.computedChecksum,
      reviewer,
      note,
      createdAt: now.toISOString(),
    })
    const reviews = await this.repo.listReviews(packKey, p.computedChecksum)
    return { ok: true, distinctReviewers: new Set(reviews.map((r) => r.reviewer)).size }
  }

  async activate(
    packKey: string,
    by: string,
    now: Date = new Date(),
  ): Promise<
    { ok: true; checksum: string } | Fail<'PACK_NOT_FOUND' | 'PACK_INVALID' | 'NEEDS_REVIEWS'>
  > {
    const p = this.registry.get(packKey)
    if (!p?.manifest) return { ok: false, code: 'PACK_NOT_FOUND', message: `no pack "${packKey}"` }
    if (!p.valid) {
      return { ok: false, code: 'PACK_INVALID', message: 'the pack has validation errors' }
    }
    const reviews = await this.repo.listReviews(packKey, p.computedChecksum)
    const distinct = new Set(reviews.map((r) => r.reviewer)).size
    if (distinct < MIN_REVIEWERS) {
      return {
        ok: false,
        code: 'NEEDS_REVIEWS',
        message: `needs ${MIN_REVIEWERS} distinct reviewers on the current checksum, has ${distinct}`,
      }
    }
    await this.repo.upsertActivation({
      packKey,
      checksum: p.computedChecksum,
      status: 'active',
      activatedBy: by,
      activatedAt: now.toISOString(),
      withdrawnBy: null,
      withdrawnAt: null,
    })
    return { ok: true, checksum: p.computedChecksum }
  }

  async withdraw(
    packKey: string,
    by: string,
    now: Date = new Date(),
  ): Promise<{ ok: true } | Fail<'NOT_ACTIVE'>> {
    const act = await this.repo.getActivation(packKey)
    if (!act || act.status !== 'active') {
      return { ok: false, code: 'NOT_ACTIVE', message: 'this pack is not active' }
    }
    await this.repo.upsertActivation({
      ...act,
      status: 'withdrawn',
      withdrawnBy: by,
      withdrawnAt: now.toISOString(),
    })
    return { ok: true }
  }
}

// --- In-memory repository ----------------------------------------------------

export class InMemoryPackGovernanceRepository implements PackGovernanceRepository {
  readonly reviews: PackReviewRecord[] = []
  readonly activations: PackActivationRecord[] = []

  async addReview(r: PackReviewRecord): Promise<void> {
    const dupe = this.reviews.some(
      (x) => x.packKey === r.packKey && x.checksum === r.checksum && x.reviewer === r.reviewer,
    )
    if (!dupe) this.reviews.push({ ...r })
  }
  async listReviews(packKey: string, checksum: string): Promise<PackReviewRecord[]> {
    return this.reviews.filter((r) => r.packKey === packKey && r.checksum === checksum)
  }
  async getActivation(packKey: string): Promise<PackActivationRecord | null> {
    return this.activations.find((a) => a.packKey === packKey) ?? null
  }
  async upsertActivation(a: PackActivationRecord): Promise<void> {
    const i = this.activations.findIndex((x) => x.packKey === a.packKey)
    if (i >= 0) this.activations[i] = { ...a }
    else this.activations.push({ ...a })
  }
}
