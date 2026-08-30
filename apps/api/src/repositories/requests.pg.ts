import type { Pool, PoolClient } from 'pg'
import type { AvailabilityState, RequestStatus } from '@rre/domain'
import type {
  AccessGrantRecord,
  EvidenceRequestRecord,
  RequestItemRecord,
  RequestRepository,
  ResponseItemRecord,
  SubmissionRecord,
} from '../services/requests.js'

/* eslint-disable @typescript-eslint/no-explicit-any -- row shapes are DB-driven */

interface RequestRow {
  id: string
  tenant_id: string
  entity_id: string
  pack_key: string
  status: RequestStatus
  message: string | null
  due_at: Date | null
  created_by: string
  created_at: Date
}
interface ItemRow {
  id: string
  tenant_id: string
  request_id: string
  control_key: string
  instructions: string | null
  required_in_request: boolean
}
interface GrantRow {
  id: string
  tenant_id: string
  request_id: string
  token_prefix: string
  token_hash: string
  scope: string
  expires_at: Date
  max_uses: number | null
  uses: number
  revoked_at: Date | null
  created_at: Date
}
interface SubmissionRow {
  id: string
  tenant_id: string
  request_id: string
  submission_version: number
  submitter_identity: string | null
  receipt_id: string
  submitted_at: Date
}
interface ResponseRow {
  id: string
  tenant_id: string
  submission_id: string
  request_item_id: string
  control_key: string
  value: string | null
  unit: string | null
  method_note: string | null
  availability_state: AvailabilityState
  comment: string | null
}

const toRequest = (r: RequestRow): EvidenceRequestRecord => ({
  id: r.id,
  tenantId: r.tenant_id,
  entityId: r.entity_id,
  packKey: r.pack_key,
  status: r.status,
  message: r.message,
  dueAt: r.due_at ? r.due_at.toISOString() : null,
  createdBy: r.created_by,
  createdAt: r.created_at.toISOString(),
})
const toItem = (r: ItemRow): RequestItemRecord => ({
  id: r.id,
  tenantId: r.tenant_id,
  requestId: r.request_id,
  controlKey: r.control_key,
  instructions: r.instructions,
  requiredInRequest: r.required_in_request,
})
export const toGrant = (r: GrantRow): AccessGrantRecord => ({
  id: r.id,
  tenantId: r.tenant_id,
  requestId: r.request_id,
  tokenPrefix: r.token_prefix,
  tokenHash: r.token_hash,
  scope: r.scope,
  expiresAt: r.expires_at.toISOString(),
  maxUses: r.max_uses,
  uses: r.uses,
  revokedAt: r.revoked_at ? r.revoked_at.toISOString() : null,
  createdAt: r.created_at.toISOString(),
})
const toSubmission = (r: SubmissionRow): SubmissionRecord => ({
  id: r.id,
  tenantId: r.tenant_id,
  requestId: r.request_id,
  submissionVersion: r.submission_version,
  submitterIdentity: r.submitter_identity,
  receiptId: r.receipt_id,
  submittedAt: r.submitted_at.toISOString(),
})
const toResponse = (r: ResponseRow): ResponseItemRecord => ({
  id: r.id,
  tenantId: r.tenant_id,
  submissionId: r.submission_id,
  requestItemId: r.request_item_id,
  controlKey: r.control_key,
  value: r.value,
  unit: r.unit,
  methodNote: r.method_note,
  availabilityState: r.availability_state,
  comment: r.comment,
})

const GRANT_COLS = `id, tenant_id, request_id, token_prefix, token_hash, scope, expires_at, max_uses, uses, revoked_at, created_at`

/** Resolve a token to its grant without a tenant context (access_token_grant has no RLS). */
export async function pgResolveGrant(
  pool: Pool,
  tokenHash: string,
): Promise<AccessGrantRecord | null> {
  const res = await pool.query<GrantRow>(
    `SELECT ${GRANT_COLS} FROM access_token_grant WHERE token_hash = $1`,
    [tokenHash],
  )
  return res.rows[0] ? toGrant(res.rows[0]) : null
}

export class PgRequestRepository implements RequestRepository {
  constructor(
    private readonly db: PoolClient,
    private readonly tenantId: string,
  ) {}

  private q<T extends Record<string, any>>(sql: string, params: any[]): Promise<{ rows: T[] }> {
    return this.db.query<T>(sql, params)
  }

  async insertRequest(r: EvidenceRequestRecord): Promise<void> {
    await this.q(
      `INSERT INTO evidence_request
         (id, tenant_id, entity_id, pack_key, status, message, due_at, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        r.id,
        r.tenantId,
        r.entityId,
        r.packKey,
        r.status,
        r.message,
        r.dueAt,
        r.createdBy,
        r.createdAt,
      ],
    )
  }
  async insertItem(i: RequestItemRecord): Promise<void> {
    await this.q(
      `INSERT INTO request_item (id, tenant_id, request_id, control_key, instructions, required_in_request)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [i.id, i.tenantId, i.requestId, i.controlKey, i.instructions, i.requiredInRequest],
    )
  }
  async getRequest(id: string): Promise<EvidenceRequestRecord | null> {
    const { rows } = await this.q<RequestRow>(
      `SELECT * FROM evidence_request WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId],
    )
    return rows[0] ? toRequest(rows[0]) : null
  }
  async listRequestsByEntity(entityId: string): Promise<EvidenceRequestRecord[]> {
    const { rows } = await this.q<RequestRow>(
      `SELECT * FROM evidence_request WHERE entity_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
      [entityId, this.tenantId],
    )
    return rows.map(toRequest)
  }
  async listItems(requestId: string): Promise<RequestItemRecord[]> {
    const { rows } = await this.q<ItemRow>(
      `SELECT * FROM request_item WHERE request_id = $1 AND tenant_id = $2 ORDER BY control_key`,
      [requestId, this.tenantId],
    )
    return rows.map(toItem)
  }
  async setRequestStatus(id: string, status: RequestStatus): Promise<void> {
    await this.q(`UPDATE evidence_request SET status = $1 WHERE id = $2 AND tenant_id = $3`, [
      status,
      id,
      this.tenantId,
    ])
  }

  async insertGrant(g: AccessGrantRecord): Promise<void> {
    await this.q(
      `INSERT INTO access_token_grant
         (id, tenant_id, request_id, token_prefix, token_hash, scope, expires_at, max_uses, uses, revoked_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        g.id,
        g.tenantId,
        g.requestId,
        g.tokenPrefix,
        g.tokenHash,
        g.scope,
        g.expiresAt,
        g.maxUses,
        g.uses,
        g.revokedAt,
        g.createdAt,
      ],
    )
  }
  async listGrantsByRequest(requestId: string): Promise<AccessGrantRecord[]> {
    const { rows } = await this.q<GrantRow>(
      `SELECT ${GRANT_COLS} FROM access_token_grant WHERE request_id = $1 AND tenant_id = $2`,
      [requestId, this.tenantId],
    )
    return rows.map(toGrant)
  }
  async revokeGrant(id: string, at: string): Promise<void> {
    await this.q(`UPDATE access_token_grant SET revoked_at = $1 WHERE id = $2`, [at, id])
  }
  async bumpGrantUses(id: string): Promise<void> {
    await this.q(`UPDATE access_token_grant SET uses = uses + 1 WHERE id = $1`, [id])
  }

  async insertSubmission(s: SubmissionRecord): Promise<void> {
    await this.q(
      `INSERT INTO contributor_submission
         (id, tenant_id, request_id, submission_version, submitter_identity, receipt_id, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        s.id,
        s.tenantId,
        s.requestId,
        s.submissionVersion,
        s.submitterIdentity,
        s.receiptId,
        s.submittedAt,
      ],
    )
  }
  async insertResponseItem(ri: ResponseItemRecord): Promise<void> {
    await this.q(
      `INSERT INTO contributor_response_item
         (id, tenant_id, submission_id, request_item_id, control_key, value, unit, method_note, availability_state, comment)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        ri.id,
        ri.tenantId,
        ri.submissionId,
        ri.requestItemId,
        ri.controlKey,
        ri.value,
        ri.unit,
        ri.methodNote,
        ri.availabilityState,
        ri.comment,
      ],
    )
  }
  async listSubmissions(requestId: string): Promise<SubmissionRecord[]> {
    const { rows } = await this.q<SubmissionRow>(
      `SELECT * FROM contributor_submission WHERE request_id = $1 AND tenant_id = $2 ORDER BY submission_version`,
      [requestId, this.tenantId],
    )
    return rows.map(toSubmission)
  }
  async getSubmission(id: string): Promise<SubmissionRecord | null> {
    const { rows } = await this.q<SubmissionRow>(
      `SELECT * FROM contributor_submission WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId],
    )
    return rows[0] ? toSubmission(rows[0]) : null
  }
  async listResponseItems(submissionId: string): Promise<ResponseItemRecord[]> {
    const { rows } = await this.q<ResponseRow>(
      `SELECT * FROM contributor_response_item WHERE submission_id = $1 AND tenant_id = $2`,
      [submissionId, this.tenantId],
    )
    return rows.map(toResponse)
  }
  async maxSubmissionVersion(requestId: string): Promise<number> {
    const { rows } = await this.q<{ max: number | null }>(
      `SELECT max(submission_version) AS max FROM contributor_submission WHERE request_id = $1 AND tenant_id = $2`,
      [requestId, this.tenantId],
    )
    return rows[0]?.max ?? 0
  }
}
