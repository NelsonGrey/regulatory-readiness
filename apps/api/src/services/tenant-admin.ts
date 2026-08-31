import { randomUUID } from 'node:crypto'
import type { AuthContext } from '../auth.js'
import type { UnitOfWork } from '../db/uow.js'
import type { ObjectStore } from '../storage/object-store.js'

/** Every tenant-owned table, for counts / dump / purge (engine TRD §21). */
export const TENANT_TABLES = [
  'regulated_entity',
  'entity_scope_evaluation',
  'claim',
  'review_decision',
  'evidence_location',
  'claim_evidence_link',
  'evidence_request',
  'request_item',
  'access_token_grant',
  'contributor_submission',
  'contributor_response_item',
  'request_draft',
  'readiness_snapshot',
  'notification',
  'document',
  'document_association',
  'extraction_run',
  'extraction_proposal',
  'applicability_override',
  'outbox',
  'audit_event',
] as const

export type TableCounts = Partial<Record<(typeof TENANT_TABLES)[number], number>>

export interface TenantDataRepository {
  counts(): Promise<TableCounts>
  dump(): Promise<Record<string, unknown[]>>
  /** Delete every tenant-owned row across every table. `deletion_request` is kept. */
  purge(): Promise<TableCounts>
}

export interface DeletionRequestRecord {
  id: string
  tenantId: string
  scope: 'tenant'
  status: 'REQUESTED' | 'COMPLETED' | 'CANCELLED'
  preview: TableCounts
  purged: TableCounts | null
  requestedBy: string
  requestedAt: string
  completedBy: string | null
  completedAt: string | null
}

export interface DeletionResultPatch {
  status: DeletionRequestRecord['status']
  purged?: TableCounts
  completedBy?: string
  completedAt?: string
}

export interface DeletionRepository {
  insert(r: DeletionRequestRecord): Promise<void>
  get(id: string): Promise<DeletionRequestRecord | null>
  list(): Promise<DeletionRequestRecord[]>
  setResult(id: string, patch: DeletionResultPatch): Promise<void>
}

type Fail<C extends string> = { ok: false; code: C; message: string }

export type RequestDeletionResult =
  { ok: true; deletionRequestId: string; preview: TableCounts } | Fail<'CONFIRMATION_MISMATCH'>

export type ExecuteDeletionResult =
  | { ok: true; purged: TableCounts; objectsRemoved: number }
  | Fail<'NOT_FOUND' | 'NOT_PENDING' | 'CONFIRMATION_MISMATCH'>

export interface TenantExportBundle {
  schemaVersion: string
  generatedAt: string
  tenantId: string
  counts: TableCounts
  tables: Record<string, unknown[]>
}

export class TenantAdminService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly store: ObjectStore,
  ) {}

  async exportBundle(auth: AuthContext, now: Date = new Date()): Promise<TenantExportBundle> {
    return this.uow(auth.tenantId, async (u) => {
      const [counts, tables] = await Promise.all([u.tenantData.counts(), u.tenantData.dump()])
      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: 'tenant.exported',
        targetType: 'tenant',
        targetId: auth.tenantId,
        occurredAt: now.toISOString(),
        metadata: { tables: Object.keys(tables).length },
      })
      return {
        schemaVersion: '1.0',
        generatedAt: now.toISOString(),
        tenantId: auth.tenantId,
        counts,
        tables,
      }
    })
  }

  async requestDeletion(
    auth: AuthContext,
    input: { confirmation: string },
    now: Date = new Date(),
  ): Promise<RequestDeletionResult> {
    if (input.confirmation !== auth.tenantId) {
      return {
        ok: false,
        code: 'CONFIRMATION_MISMATCH',
        message: 'the confirmation must equal the workspace id',
      }
    }
    return this.uow(auth.tenantId, async (u) => {
      const preview = await u.tenantData.counts()
      const at = now.toISOString()
      const id = `del_${randomUUID()}`
      await u.deletions.insert({
        id,
        tenantId: auth.tenantId,
        scope: 'tenant',
        status: 'REQUESTED',
        preview,
        purged: null,
        requestedBy: auth.actor,
        requestedAt: at,
        completedBy: null,
        completedAt: null,
      })
      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: 'deletion.requested',
        targetType: 'tenant',
        targetId: auth.tenantId,
        occurredAt: at,
        metadata: { deletionRequestId: id, previewRows: sumCounts(preview) },
      })
      return { ok: true, deletionRequestId: id, preview }
    })
  }

  async listDeletionRequests(auth: AuthContext): Promise<DeletionRequestRecord[]> {
    return this.uow(auth.tenantId, (u) => u.deletions.list())
  }

  async executeDeletion(
    auth: AuthContext,
    deletionRequestId: string,
    input: { confirmation: string },
    now: Date = new Date(),
  ): Promise<ExecuteDeletionResult> {
    if (input.confirmation !== auth.tenantId) {
      return {
        ok: false,
        code: 'CONFIRMATION_MISMATCH',
        message: 'the confirmation must equal the workspace id',
      }
    }

    type Outcome = { fail: 'NOT_FOUND' | 'NOT_PENDING' } | { fail: null; counts: TableCounts }

    const outcome: Outcome = await this.uow(auth.tenantId, async (u): Promise<Outcome> => {
      const req = await u.deletions.get(deletionRequestId)
      if (!req) return { fail: 'NOT_FOUND' }
      if (req.status !== 'REQUESTED') return { fail: 'NOT_PENDING' }

      const counts = await u.tenantData.purge()
      const at = now.toISOString()
      await u.deletions.setResult(deletionRequestId, {
        status: 'COMPLETED',
        purged: counts,
        completedBy: auth.actor,
        completedAt: at,
      })
      // written after the purge so it is the only surviving audit row for the tenant
      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: 'deletion.completed',
        targetType: 'tenant',
        targetId: auth.tenantId,
        occurredAt: at,
        metadata: { deletionRequestId, purgedRows: sumCounts(counts) },
      })
      return { fail: null, counts }
    })
    if (outcome.fail) {
      return {
        ok: false,
        code: outcome.fail,
        message: outcome.fail.toLowerCase().replace(/_/g, ' '),
      }
    }

    let objectsRemoved = 0
    try {
      objectsRemoved = await this.store.deleteTenant(auth.tenantId)
    } catch {
      // object cleanup is best-effort; the DB purge already committed
    }
    return { ok: true, purged: outcome.counts, objectsRemoved }
  }
}

function sumCounts(c: TableCounts): number {
  return Object.values(c).reduce((a, b) => a + (b ?? 0), 0)
}
