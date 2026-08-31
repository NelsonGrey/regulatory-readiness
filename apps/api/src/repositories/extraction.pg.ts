import type { PoolClient } from 'pg'
import type {
  ExtractionProposalRecord,
  ExtractionRepository,
  ExtractionRunRecord,
  ProposalDecisionPatch,
  ProposalStatus,
  RunResultPatch,
  RunStatus,
} from '../services/extraction.js'
import type { ValidationFinding } from '../extraction/validate.js'

interface RunRow {
  id: string
  tenant_id: string
  document_id: string
  entity_id: string
  extractor_name: string
  model_id: string
  schema_version: string
  document_hash: string | null
  status: RunStatus
  error: string | null
  proposal_count: number
  started_by: string
  started_at: Date
  finished_at: Date | null
}

interface ProposalRow {
  id: string
  tenant_id: string
  run_id: string
  document_id: string
  control_key: string
  value: string
  unit: string | null
  method: string | null
  confidence: string | null
  page: number | null
  quote: string
  validation: ValidationFinding[]
  status: ProposalStatus
  decided_by: string | null
  decided_at: Date | null
  reason: string | null
  accepted_claim_id: string | null
  created_at: Date
}

const toRun = (r: RunRow): ExtractionRunRecord => ({
  id: r.id,
  tenantId: r.tenant_id,
  documentId: r.document_id,
  entityId: r.entity_id,
  extractorName: r.extractor_name,
  modelId: r.model_id,
  schemaVersion: r.schema_version,
  documentHash: r.document_hash,
  status: r.status,
  error: r.error,
  proposalCount: r.proposal_count,
  startedBy: r.started_by,
  startedAt: r.started_at.toISOString(),
  finishedAt: r.finished_at ? r.finished_at.toISOString() : null,
})

const toProposal = (r: ProposalRow): ExtractionProposalRecord => ({
  id: r.id,
  tenantId: r.tenant_id,
  runId: r.run_id,
  documentId: r.document_id,
  controlKey: r.control_key,
  value: r.value,
  unit: r.unit,
  method: r.method,
  confidence: r.confidence === null ? null : Number(r.confidence),
  page: r.page,
  quote: r.quote,
  validation: r.validation,
  status: r.status,
  decidedBy: r.decided_by,
  decidedAt: r.decided_at ? r.decided_at.toISOString() : null,
  reason: r.reason,
  acceptedClaimId: r.accepted_claim_id,
  createdAt: r.created_at.toISOString(),
})

export class PgExtractionRepository implements ExtractionRepository {
  constructor(
    private readonly db: PoolClient,
    private readonly tenantId: string,
  ) {}

  async insertRun(run: ExtractionRunRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO extraction_run
         (id, tenant_id, document_id, entity_id, extractor_name, model_id, schema_version,
          document_hash, status, error, proposal_count, started_by, started_at, finished_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        run.id,
        run.tenantId,
        run.documentId,
        run.entityId,
        run.extractorName,
        run.modelId,
        run.schemaVersion,
        run.documentHash,
        run.status,
        run.error,
        run.proposalCount,
        run.startedBy,
        run.startedAt,
        run.finishedAt,
      ],
    )
  }

  async getRun(id: string): Promise<ExtractionRunRecord | null> {
    const res = await this.db.query<RunRow>(
      `SELECT * FROM extraction_run WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId],
    )
    return res.rows[0] ? toRun(res.rows[0]) : null
  }

  async listRunsByDocument(documentId: string): Promise<ExtractionRunRecord[]> {
    const res = await this.db.query<RunRow>(
      `SELECT * FROM extraction_run WHERE document_id = $1 AND tenant_id = $2 ORDER BY seq DESC`,
      [documentId, this.tenantId],
    )
    return res.rows.map(toRun)
  }

  async setRunResult(id: string, patch: RunResultPatch): Promise<void> {
    await this.db.query(
      `UPDATE extraction_run
          SET status = $1, error = $2,
              proposal_count = COALESCE($3, proposal_count),
              finished_at = COALESCE($4, finished_at)
        WHERE id = $5 AND tenant_id = $6`,
      [
        patch.status,
        patch.error ?? null,
        patch.proposalCount ?? null,
        patch.finishedAt ?? null,
        id,
        this.tenantId,
      ],
    )
  }

  async insertProposal(p: ExtractionProposalRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO extraction_proposal
         (id, tenant_id, run_id, document_id, control_key, value, unit, method, confidence,
          page, quote, validation, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        p.id,
        p.tenantId,
        p.runId,
        p.documentId,
        p.controlKey,
        p.value,
        p.unit,
        p.method,
        p.confidence,
        p.page,
        p.quote,
        JSON.stringify(p.validation),
        p.status,
        p.createdAt,
      ],
    )
  }

  async getProposal(id: string): Promise<ExtractionProposalRecord | null> {
    const res = await this.db.query<ProposalRow>(
      `SELECT * FROM extraction_proposal WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId],
    )
    return res.rows[0] ? toProposal(res.rows[0]) : null
  }

  async listProposalsByRun(runId: string): Promise<ExtractionProposalRecord[]> {
    const res = await this.db.query<ProposalRow>(
      `SELECT * FROM extraction_proposal WHERE run_id = $1 AND tenant_id = $2 ORDER BY seq`,
      [runId, this.tenantId],
    )
    return res.rows.map(toProposal)
  }

  async setProposalDecision(id: string, patch: ProposalDecisionPatch): Promise<void> {
    await this.db.query(
      `UPDATE extraction_proposal
          SET status = $1, decided_by = $2, decided_at = $3,
              reason = COALESCE($4, reason),
              accepted_claim_id = COALESCE($5, accepted_claim_id)
        WHERE id = $6 AND tenant_id = $7`,
      [
        patch.status,
        patch.decidedBy,
        patch.decidedAt,
        patch.reason ?? null,
        patch.acceptedClaimId ?? null,
        id,
        this.tenantId,
      ],
    )
  }
}
