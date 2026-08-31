import type { Pool } from 'pg'
import type {
  PackSourceChangeRecord,
  PackSourceCheckPatch,
  PackSourceCheckRecord,
  PackSourceRepository,
} from '../services/pack-source.js'

interface CheckRow {
  url: string
  pack_keys: string[]
  last_hash: string | null
  last_status: PackSourceCheckRecord['lastStatus']
  last_checked_at: Date | null
  last_error: string | null
  etag: string | null
  updated_at: Date
}
interface ChangeRow {
  id: string
  url: string
  pack_keys: string[]
  from_hash: string | null
  to_hash: string
  detected_at: Date
  acknowledged_by: string | null
  acknowledged_at: Date | null
}

const toCheck = (r: CheckRow): PackSourceCheckRecord => ({
  url: r.url,
  packKeys: r.pack_keys,
  lastHash: r.last_hash,
  lastStatus: r.last_status,
  lastCheckedAt: r.last_checked_at ? r.last_checked_at.toISOString() : null,
  lastError: r.last_error,
  etag: r.etag,
  updatedAt: r.updated_at.toISOString(),
})
const toChange = (r: ChangeRow): PackSourceChangeRecord => ({
  id: r.id,
  url: r.url,
  packKeys: r.pack_keys,
  fromHash: r.from_hash,
  toHash: r.to_hash,
  detectedAt: r.detected_at.toISOString(),
  acknowledgedBy: r.acknowledged_by,
  acknowledgedAt: r.acknowledged_at ? r.acknowledged_at.toISOString() : null,
})

/** Pack source monitoring on a plain pool — no RLS, platform-scoped. */
export class PgPackSourceRepository implements PackSourceRepository {
  constructor(private readonly pool: Pool) {}

  async getCheck(url: string): Promise<PackSourceCheckRecord | null> {
    const r = await this.pool.query<CheckRow>(`SELECT * FROM pack_source_check WHERE url = $1`, [
      url,
    ])
    return r.rows[0] ? toCheck(r.rows[0]) : null
  }

  async upsertCheck(url: string, p: PackSourceCheckPatch): Promise<void> {
    await this.pool.query(
      `INSERT INTO pack_source_check
         (url, pack_keys, last_hash, last_status, last_checked_at, last_error, etag, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (url) DO UPDATE SET
         pack_keys = EXCLUDED.pack_keys,
         last_hash = CASE WHEN $9::boolean THEN EXCLUDED.last_hash ELSE pack_source_check.last_hash END,
         last_status = EXCLUDED.last_status,
         last_checked_at = EXCLUDED.last_checked_at,
         last_error = EXCLUDED.last_error,
         etag = CASE WHEN $10::boolean THEN EXCLUDED.etag ELSE pack_source_check.etag END,
         updated_at = EXCLUDED.updated_at`,
      [
        url,
        p.packKeys,
        p.hash ?? null,
        p.status,
        p.checkedAt,
        p.error ?? null,
        p.etag ?? null,
        p.checkedAt,
        p.hash !== undefined,
        p.etag !== undefined,
      ],
    )
  }

  async listChecks(): Promise<PackSourceCheckRecord[]> {
    const r = await this.pool.query<CheckRow>(`SELECT * FROM pack_source_check ORDER BY url ASC`)
    return r.rows.map(toCheck)
  }

  async insertChange(c: PackSourceChangeRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO pack_source_change
         (id, url, pack_keys, from_hash, to_hash, detected_at, acknowledged_by, acknowledged_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        c.id,
        c.url,
        c.packKeys,
        c.fromHash,
        c.toHash,
        c.detectedAt,
        c.acknowledgedBy,
        c.acknowledgedAt,
      ],
    )
  }

  async listChanges(opts?: { includeAcknowledged?: boolean }): Promise<PackSourceChangeRecord[]> {
    const r = await this.pool.query<ChangeRow>(
      `SELECT * FROM pack_source_change
        ${opts?.includeAcknowledged ? '' : 'WHERE acknowledged_at IS NULL'}
        ORDER BY detected_at DESC`,
    )
    return r.rows.map(toChange)
  }

  async acknowledge(id: string, by: string, at: string): Promise<boolean> {
    const r = await this.pool.query(
      `UPDATE pack_source_change SET acknowledged_by = $2, acknowledged_at = $3
        WHERE id = $1 AND acknowledged_at IS NULL`,
      [id, by, at],
    )
    return (r.rowCount ?? 0) > 0
  }
}
