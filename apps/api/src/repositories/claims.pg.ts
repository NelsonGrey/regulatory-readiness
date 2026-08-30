import type { PoolClient } from 'pg'
import type { ClaimStatus } from '@rre/domain'
import type { ClaimRecord, ClaimRepository, ReviewDecisionRecord } from '../services/claims.js'

interface ClaimRow {
  id: string
  tenant_id: string
  entity_id: string
  control_key: string
  pack_key: string
  origin: ClaimRecord['origin']
  revision: number
  supersedes_claim_id: string | null
  status: ClaimStatus
  value: string
  unit: string | null
  method_context: string | null
  asof_date: Date | null
  note: string | null
  evidence_url: string | null
  asserted_by: string
  asserted_at: Date
}

function toClaim(r: ClaimRow): ClaimRecord {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    entityId: r.entity_id,
    controlKey: r.control_key,
    packKey: r.pack_key,
    origin: r.origin,
    revision: r.revision,
    supersedesClaimId: r.supersedes_claim_id,
    status: r.status,
    value: r.value,
    unit: r.unit,
    methodContext: r.method_context,
    asOfDate: r.asof_date ? r.asof_date.toISOString().slice(0, 10) : null,
    note: r.note,
    evidenceUrl: r.evidence_url,
    assertedBy: r.asserted_by,
    assertedAt: r.asserted_at.toISOString(),
  }
}

const SELECT = `SELECT id, tenant_id, entity_id, control_key, pack_key, origin, revision,
  supersedes_claim_id, status, value, unit, method_context, asof_date, note, evidence_url,
  asserted_by, asserted_at FROM claim`

export class PgClaimRepository implements ClaimRepository {
  constructor(
    private readonly db: PoolClient,
    private readonly tenantId: string,
  ) {}

  async insert(c: ClaimRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO claim
         (id, tenant_id, entity_id, control_key, pack_key, origin, revision, supersedes_claim_id,
          status, value, unit, method_context, asof_date, note, evidence_url, asserted_by, asserted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        c.id,
        c.tenantId,
        c.entityId,
        c.controlKey,
        c.packKey,
        c.origin,
        c.revision,
        c.supersedesClaimId,
        c.status,
        c.value,
        c.unit,
        c.methodContext,
        c.asOfDate,
        c.note,
        c.evidenceUrl,
        c.assertedBy,
        c.assertedAt,
      ],
    )
  }

  async get(id: string): Promise<ClaimRecord | null> {
    const res = await this.db.query<ClaimRow>(`${SELECT} WHERE id = $1 AND tenant_id = $2`, [
      id,
      this.tenantId,
    ])
    return res.rows[0] ? toClaim(res.rows[0]) : null
  }

  async listByEntity(entityId: string): Promise<ClaimRecord[]> {
    const res = await this.db.query<ClaimRow>(
      `${SELECT} WHERE entity_id = $1 AND tenant_id = $2 ORDER BY control_key, revision`,
      [entityId, this.tenantId],
    )
    return res.rows.map(toClaim)
  }

  async setStatus(
    id: string,
    status: ClaimStatus,
    supersedesClaimId?: string | null,
  ): Promise<void> {
    if (supersedesClaimId === undefined) {
      await this.db.query(`UPDATE claim SET status = $1 WHERE id = $2 AND tenant_id = $3`, [
        status,
        id,
        this.tenantId,
      ])
    } else {
      await this.db.query(
        `UPDATE claim SET status = $1, supersedes_claim_id = $2 WHERE id = $3 AND tenant_id = $4`,
        [status, supersedesClaimId, id, this.tenantId],
      )
    }
  }

  async recordDecision(d: ReviewDecisionRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO review_decision (id, tenant_id, claim_id, decision, reason, reviewer, decided_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [d.id, d.tenantId, d.claimId, d.decision, d.reason, d.reviewer, d.decidedAt],
    )
  }

  async maxRevision(entityId: string, controlKey: string): Promise<number> {
    const res = await this.db.query<{ max: number | null }>(
      `SELECT max(revision) AS max FROM claim
       WHERE tenant_id = $1 AND entity_id = $2 AND control_key = $3`,
      [this.tenantId, entityId, controlKey],
    )
    return res.rows[0]?.max ?? 0
  }
}
