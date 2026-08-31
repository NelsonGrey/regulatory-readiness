import type { PoolClient } from 'pg'
import type { ApplicabilityResult } from '@rre/contracts'
import type { ApplicabilityOverrideRecord, OverrideRepository } from '../services/overrides.js'

interface OverrideRow {
  id: string
  tenant_id: string
  entity_id: string
  control_key: string
  result: ApplicabilityResult
  rationale: string
  source_ref: string | null
  effective_evaluation_id: string
  expires_at: Date | null
  created_by: string
  created_at: Date
  revoked_at: Date | null
}

const toRecord = (r: OverrideRow): ApplicabilityOverrideRecord => ({
  id: r.id,
  tenantId: r.tenant_id,
  entityId: r.entity_id,
  controlKey: r.control_key,
  result: r.result,
  rationale: r.rationale,
  sourceRef: r.source_ref,
  effectiveEvaluationId: r.effective_evaluation_id,
  expiresAt: r.expires_at ? r.expires_at.toISOString() : null,
  createdBy: r.created_by,
  createdAt: r.created_at.toISOString(),
  revokedAt: r.revoked_at ? r.revoked_at.toISOString() : null,
})

export class PgOverrideRepository implements OverrideRepository {
  constructor(
    private readonly db: PoolClient,
    private readonly tenantId: string,
  ) {}

  async insert(o: ApplicabilityOverrideRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO applicability_override
         (id, tenant_id, entity_id, control_key, result, rationale, source_ref,
          effective_evaluation_id, expires_at, created_by, created_at, revoked_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        o.id,
        o.tenantId,
        o.entityId,
        o.controlKey,
        o.result,
        o.rationale,
        o.sourceRef,
        o.effectiveEvaluationId,
        o.expiresAt,
        o.createdBy,
        o.createdAt,
        o.revokedAt,
      ],
    )
  }

  async get(id: string): Promise<ApplicabilityOverrideRecord | null> {
    const res = await this.db.query<OverrideRow>(
      `SELECT * FROM applicability_override WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId],
    )
    return res.rows[0] ? toRecord(res.rows[0]) : null
  }

  async listByEntity(entityId: string): Promise<ApplicabilityOverrideRecord[]> {
    const res = await this.db.query<OverrideRow>(
      `SELECT * FROM applicability_override
        WHERE entity_id = $1 AND tenant_id = $2
        ORDER BY seq DESC`,
      [entityId, this.tenantId],
    )
    return res.rows.map(toRecord)
  }

  async revoke(id: string, at: string): Promise<void> {
    await this.db.query(
      `UPDATE applicability_override SET revoked_at = $1 WHERE id = $2 AND tenant_id = $3`,
      [at, id, this.tenantId],
    )
  }
}
