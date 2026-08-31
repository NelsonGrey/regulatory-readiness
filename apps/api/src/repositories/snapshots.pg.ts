import type { PoolClient } from 'pg'
import type { CanonicalExport, EntityStatus } from '@rre/domain'
import type { SnapshotRecord, SnapshotRepository, SnapshotSummary } from '../services/snapshots.js'

interface SnapshotRow {
  id: string
  tenant_id: string
  entity_id: string
  pack_key: string
  snapshot_key: string
  evaluation_id: string
  entity_status: EntityStatus
  readiness_counts: Record<string, number>
  document: CanonicalExport
  content_hash: string
  created_by: string
  created_at: Date
}

const SUMMARY_COLS = `id, tenant_id, entity_id, pack_key, snapshot_key, evaluation_id,
  entity_status, readiness_counts, content_hash, created_by, created_at`

function toSummary(r: Omit<SnapshotRow, 'document'>): SnapshotSummary {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    entityId: r.entity_id,
    packKey: r.pack_key,
    snapshotKey: r.snapshot_key,
    evaluationId: r.evaluation_id,
    entityStatus: r.entity_status,
    readinessCounts: r.readiness_counts,
    contentHash: r.content_hash,
    createdBy: r.created_by,
    createdAt: r.created_at.toISOString(),
  }
}

function toRecord(r: SnapshotRow): SnapshotRecord {
  return { ...toSummary(r), document: r.document }
}

export class PgSnapshotRepository implements SnapshotRepository {
  constructor(
    private readonly db: PoolClient,
    private readonly tenantId: string,
  ) {}

  async insert(s: SnapshotRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO readiness_snapshot
         (id, tenant_id, entity_id, pack_key, snapshot_key, evaluation_id,
          entity_status, readiness_counts, document, content_hash, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        s.id,
        s.tenantId,
        s.entityId,
        s.packKey,
        s.snapshotKey,
        s.evaluationId,
        s.entityStatus,
        JSON.stringify(s.readinessCounts),
        JSON.stringify(s.document),
        s.contentHash,
        s.createdBy,
        s.createdAt,
      ],
    )
  }

  async get(id: string): Promise<SnapshotRecord | null> {
    const res = await this.db.query<SnapshotRow>(
      `SELECT * FROM readiness_snapshot WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId],
    )
    return res.rows[0] ? toRecord(res.rows[0]) : null
  }

  async listByEntity(entityId: string): Promise<SnapshotSummary[]> {
    const res = await this.db.query<Omit<SnapshotRow, 'document'>>(
      `SELECT ${SUMMARY_COLS} FROM readiness_snapshot
        WHERE entity_id = $1 AND tenant_id = $2
        ORDER BY seq DESC`,
      [entityId, this.tenantId],
    )
    return res.rows.map(toSummary)
  }
}
