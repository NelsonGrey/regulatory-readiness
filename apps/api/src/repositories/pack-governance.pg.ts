import type { Pool } from 'pg'
import type {
  PackActivationRecord,
  PackGovernanceRepository,
  PackReviewRecord,
} from '../services/pack-governance.js'

interface ReviewRow {
  id: string
  pack_key: string
  checksum: string
  reviewer: string
  note: string | null
  created_at: Date
}
interface ActivationRow {
  pack_key: string
  checksum: string
  status: 'active' | 'withdrawn'
  activated_by: string
  activated_at: Date
  withdrawn_by: string | null
  withdrawn_at: Date | null
}

/** Pack governance on a plain pool — no RLS, platform-scoped. */
export class PgPackGovernanceRepository implements PackGovernanceRepository {
  constructor(private readonly pool: Pool) {}

  async addReview(r: PackReviewRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO pack_review (id, pack_key, checksum, reviewer, note, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (pack_key, checksum, reviewer) DO NOTHING`,
      [r.id, r.packKey, r.checksum, r.reviewer, r.note, r.createdAt],
    )
  }

  async listReviews(packKey: string, checksum: string): Promise<PackReviewRecord[]> {
    const res = await this.pool.query<ReviewRow>(
      `SELECT * FROM pack_review WHERE pack_key = $1 AND checksum = $2 ORDER BY created_at ASC`,
      [packKey, checksum],
    )
    return res.rows.map((r) => ({
      id: r.id,
      packKey: r.pack_key,
      checksum: r.checksum,
      reviewer: r.reviewer,
      note: r.note,
      createdAt: r.created_at.toISOString(),
    }))
  }

  async getActivation(packKey: string): Promise<PackActivationRecord | null> {
    const res = await this.pool.query<ActivationRow>(
      `SELECT * FROM pack_activation WHERE pack_key = $1`,
      [packKey],
    )
    const r = res.rows[0]
    if (!r) return null
    return {
      packKey: r.pack_key,
      checksum: r.checksum,
      status: r.status,
      activatedBy: r.activated_by,
      activatedAt: r.activated_at.toISOString(),
      withdrawnBy: r.withdrawn_by,
      withdrawnAt: r.withdrawn_at ? r.withdrawn_at.toISOString() : null,
    }
  }

  async upsertActivation(a: PackActivationRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO pack_activation
         (pack_key, checksum, status, activated_by, activated_at, withdrawn_by, withdrawn_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (pack_key) DO UPDATE SET
         checksum = EXCLUDED.checksum,
         status = EXCLUDED.status,
         activated_by = EXCLUDED.activated_by,
         activated_at = EXCLUDED.activated_at,
         withdrawn_by = EXCLUDED.withdrawn_by,
         withdrawn_at = EXCLUDED.withdrawn_at`,
      [a.packKey, a.checksum, a.status, a.activatedBy, a.activatedAt, a.withdrawnBy, a.withdrawnAt],
    )
  }
}
