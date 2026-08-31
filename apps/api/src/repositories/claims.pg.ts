import type { PoolClient } from 'pg'
import type { ClaimStatus } from '@rre/domain'
import type {
  ClaimEvidenceLinkRecord,
  ClaimRecord,
  ClaimRepository,
  EvidenceLocationRecord,
  EvidenceView,
  ReviewDecisionRecord,
  SupportType,
} from '../services/claims.js'

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

  async linkEvidence(
    location: EvidenceLocationRecord,
    link: ClaimEvidenceLinkRecord,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO evidence_location
         (id, tenant_id, document_id, page, sheet, cell, bbox, quote, location_hash, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        location.id,
        location.tenantId,
        location.documentId,
        location.page,
        location.sheet,
        location.cell,
        location.bbox === null ? null : JSON.stringify(location.bbox),
        location.quote,
        location.locationHash,
        location.createdBy,
        location.createdAt,
      ],
    )
    await this.db.query(
      `INSERT INTO claim_evidence_link
         (id, tenant_id, claim_id, evidence_location_id, support_type, added_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (claim_id, evidence_location_id) DO NOTHING`,
      [
        link.id,
        link.tenantId,
        link.claimId,
        link.evidenceLocationId,
        link.supportType,
        link.addedBy,
        link.createdAt,
      ],
    )
  }

  private evidenceQuery(where: string, param: string): Promise<{ rows: EvidenceRow[] }> {
    return this.db.query<EvidenceRow>(
      `SELECT l.id AS link_id, l.claim_id, l.support_type, l.added_by, l.created_at,
              e.document_id, e.page, e.sheet, e.cell, e.quote,
              d.filename AS document_filename, d.content_hash AS document_hash
         FROM claim_evidence_link l
         JOIN evidence_location e ON e.id = l.evidence_location_id AND e.tenant_id = l.tenant_id
         LEFT JOIN document d ON d.id = e.document_id AND d.tenant_id = l.tenant_id
        WHERE l.tenant_id = $1 AND ${where}
        ORDER BY l.created_at`,
      [this.tenantId, param],
    )
  }

  async listEvidenceByClaim(claimId: string): Promise<EvidenceView[]> {
    const { rows } = await this.evidenceQuery('l.claim_id = $2', claimId)
    return rows.map(toEvidenceView)
  }

  async listEvidenceByEntity(entityId: string): Promise<EvidenceView[]> {
    const { rows } = await this.db.query<EvidenceRow>(
      `SELECT l.id AS link_id, l.claim_id, l.support_type, l.added_by, l.created_at,
              e.document_id, e.page, e.sheet, e.cell, e.quote,
              d.filename AS document_filename, d.content_hash AS document_hash
         FROM claim_evidence_link l
         JOIN claim c ON c.id = l.claim_id AND c.tenant_id = l.tenant_id
         JOIN evidence_location e ON e.id = l.evidence_location_id AND e.tenant_id = l.tenant_id
         LEFT JOIN document d ON d.id = e.document_id AND d.tenant_id = l.tenant_id
        WHERE l.tenant_id = $1 AND c.entity_id = $2
        ORDER BY l.created_at`,
      [this.tenantId, entityId],
    )
    return rows.map(toEvidenceView)
  }
}

interface EvidenceRow {
  link_id: string
  claim_id: string
  support_type: SupportType
  added_by: string
  created_at: Date
  document_id: string
  page: number | null
  sheet: string | null
  cell: string | null
  quote: string | null
  document_filename: string | null
  document_hash: string | null
}

function toEvidenceView(r: EvidenceRow): EvidenceView {
  return {
    linkId: r.link_id,
    claimId: r.claim_id,
    supportType: r.support_type,
    documentId: r.document_id,
    documentFilename: r.document_filename,
    documentHash: r.document_hash,
    page: r.page,
    sheet: r.sheet,
    cell: r.cell,
    quote: r.quote,
    addedBy: r.added_by,
    createdAt: r.created_at.toISOString(),
  }
}
