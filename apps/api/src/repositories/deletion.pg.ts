import type { PoolClient } from 'pg'
import type {
  DeletionRepository,
  DeletionRequestRecord,
  DeletionResultPatch,
  TableCounts,
} from '../services/tenant-admin.js'

interface DeletionRow {
  id: string
  tenant_id: string
  scope: 'tenant'
  status: DeletionRequestRecord['status']
  preview: TableCounts
  purged: TableCounts | null
  requested_by: string
  requested_at: Date
  completed_by: string | null
  completed_at: Date | null
}

const toRecord = (r: DeletionRow): DeletionRequestRecord => ({
  id: r.id,
  tenantId: r.tenant_id,
  scope: r.scope,
  status: r.status,
  preview: r.preview,
  purged: r.purged,
  requestedBy: r.requested_by,
  requestedAt: r.requested_at.toISOString(),
  completedBy: r.completed_by,
  completedAt: r.completed_at ? r.completed_at.toISOString() : null,
})

export class PgDeletionRepository implements DeletionRepository {
  constructor(
    private readonly db: PoolClient,
    private readonly tenantId: string,
  ) {}

  async insert(r: DeletionRequestRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO deletion_request
         (id, tenant_id, scope, status, preview, purged, requested_by, requested_at,
          completed_by, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        r.id,
        r.tenantId,
        r.scope,
        r.status,
        JSON.stringify(r.preview),
        r.purged === null ? null : JSON.stringify(r.purged),
        r.requestedBy,
        r.requestedAt,
        r.completedBy,
        r.completedAt,
      ],
    )
  }

  async get(id: string): Promise<DeletionRequestRecord | null> {
    const res = await this.db.query<DeletionRow>(
      `SELECT * FROM deletion_request WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId],
    )
    return res.rows[0] ? toRecord(res.rows[0]) : null
  }

  async list(): Promise<DeletionRequestRecord[]> {
    const res = await this.db.query<DeletionRow>(
      `SELECT * FROM deletion_request WHERE tenant_id = $1 ORDER BY seq DESC`,
      [this.tenantId],
    )
    return res.rows.map(toRecord)
  }

  async setResult(id: string, patch: DeletionResultPatch): Promise<void> {
    await this.db.query(
      `UPDATE deletion_request
          SET status = $1,
              purged = COALESCE($2, purged),
              completed_by = COALESCE($3, completed_by),
              completed_at = COALESCE($4, completed_at)
        WHERE id = $5 AND tenant_id = $6`,
      [
        patch.status,
        patch.purged === undefined ? null : JSON.stringify(patch.purged),
        patch.completedBy ?? null,
        patch.completedAt ?? null,
        id,
        this.tenantId,
      ],
    )
  }
}
