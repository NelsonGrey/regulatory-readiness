import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import type { ClaimStatus, EntityScopeEvaluation, RegulatedEntity } from '@rre/domain'
import { withTenant } from '@rre/db'
import { PgEntityRepository } from '../repositories/entities.pg.js'
import { PgClaimRepository } from '../repositories/claims.pg.js'
import { PgRequestRepository } from '../repositories/requests.pg.js'
import { PgSnapshotRepository } from '../repositories/snapshots.pg.js'
import { PgNotificationRepository } from '../repositories/notifications.pg.js'
import type { EntityRepository } from '../services/entities.js'
import type { ClaimRecord, ClaimRepository, ReviewDecisionRecord } from '../services/claims.js'
import type { SnapshotRecord, SnapshotRepository } from '../services/snapshots.js'
import type { NotificationRecord, NotificationRepository } from '../services/notifications.js'
import type {
  AccessGrantRecord,
  DraftRecord,
  EvidenceRequestRecord,
  RequestItemRecord,
  RequestRepository,
  ResponseItemRecord,
  SubmissionRecord,
} from '../services/requests.js'
import type { RequestStatus } from '@rre/domain'

/** One audit event (engine TRD §20). Safe metadata only — never document text, claim values, or tokens. */
export interface AuditInput {
  actorType: 'user' | 'token' | 'system' | 'support'
  actorId: string
  action: string
  targetType: string
  targetId: string
  occurredAt: string
  correlationId?: string
  reason?: string
  metadata?: Record<string, unknown>
}

export interface AuditRecord extends AuditInput {
  id: string
  /** Monotonic cursor (string; Postgres bigint). Assigned on commit. */
  seq: string
  tenantId: string
  metadata: Record<string, unknown>
}

/** Filters for reading the audit trail (AUD-001). Newest first; `before` is an exclusive `seq` cursor. */
export interface AuditQuery {
  targetType?: string
  targetId?: string
  action?: string
  since?: string
  before?: string
  limit: number
}

export interface OutboxRecord {
  id: string
  tenantId: string
  topic: string
  payload: unknown
  createdAt: string
  publishedAt: string | null
  attempts: number
}

/**
 * A unit of work: business writes, the audit event, and outbox messages all
 * commit atomically inside one tenant-scoped transaction (ADR 0004).
 */
export interface Uow {
  readonly tenantId: string
  readonly entities: EntityRepository
  readonly claims: ClaimRepository
  readonly requests: RequestRepository
  readonly snapshots: SnapshotRepository
  readonly notifications: NotificationRepository
  audit(event: AuditInput): Promise<void>
  enqueue(topic: string, payload: unknown): Promise<void>
  queryAudit(query: AuditQuery): Promise<AuditRecord[]>
}

export type UnitOfWork = <T>(tenantId: string, fn: (uow: Uow) => Promise<T>) => Promise<T>

// --- Postgres ---------------------------------------------------------------

export function pgUnitOfWork(pool: Pool): UnitOfWork {
  return (tenantId, fn) =>
    withTenant(pool, tenantId, async (client) => {
      const uow: Uow = {
        tenantId,
        entities: new PgEntityRepository(client, tenantId),
        claims: new PgClaimRepository(client, tenantId),
        requests: new PgRequestRepository(client, tenantId),
        snapshots: new PgSnapshotRepository(client, tenantId),
        notifications: new PgNotificationRepository(client, tenantId),
        async audit(ev) {
          await client.query(
            `INSERT INTO audit_event
               (id, tenant_id, actor_type, actor_id, action, target_type, target_id,
                occurred_at, correlation_id, reason, metadata)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              `aud_${randomUUID()}`,
              tenantId,
              ev.actorType,
              ev.actorId,
              ev.action,
              ev.targetType,
              ev.targetId,
              ev.occurredAt,
              ev.correlationId ?? null,
              ev.reason ?? null,
              JSON.stringify(ev.metadata ?? {}),
            ],
          )
        },
        async enqueue(topic, payload) {
          await client.query(
            `INSERT INTO outbox (id, tenant_id, topic, payload) VALUES ($1,$2,$3,$4)`,
            [`obx_${randomUUID()}`, tenantId, topic, JSON.stringify(payload)],
          )
        },
        async queryAudit(q) {
          const res = await client.query<AuditRow>(
            `SELECT id, seq::text AS seq, tenant_id, actor_type, actor_id, action,
                    target_type, target_id, occurred_at, correlation_id, reason, metadata
             FROM audit_event
             WHERE ($1::text IS NULL OR target_type = $1)
               AND ($2::text IS NULL OR target_id = $2)
               AND ($3::text IS NULL OR action = $3)
               AND ($4::timestamptz IS NULL OR occurred_at >= $4)
               AND ($5::bigint IS NULL OR seq < $5::bigint)
             ORDER BY seq DESC
             LIMIT $6`,
            [
              q.targetType ?? null,
              q.targetId ?? null,
              q.action ?? null,
              q.since ?? null,
              q.before ?? null,
              q.limit,
            ],
          )
          return res.rows.map(rowToAuditRecord)
        },
      }
      return fn(uow)
    })
}

interface AuditRow {
  id: string
  seq: string
  tenant_id: string
  actor_type: AuditInput['actorType']
  actor_id: string
  action: string
  target_type: string
  target_id: string
  occurred_at: Date
  correlation_id: string | null
  reason: string | null
  metadata: Record<string, unknown>
}

function rowToAuditRecord(r: AuditRow): AuditRecord {
  return {
    id: r.id,
    seq: r.seq,
    tenantId: r.tenant_id,
    actorType: r.actor_type,
    actorId: r.actor_id,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    occurredAt: r.occurred_at.toISOString(),
    correlationId: r.correlation_id ?? undefined,
    reason: r.reason ?? undefined,
    metadata: r.metadata,
  }
}

// --- In-memory ------------------------------------------------------------------

export interface InMemoryStores {
  entities: Map<string, RegulatedEntity>
  evaluations: Map<string, EntityScopeEvaluation>
  audit: AuditRecord[]
  outbox: OutboxRecord[]
  claims: ClaimRecord[]
  decisions: ReviewDecisionRecord[]
  requests: EvidenceRequestRecord[]
  requestItems: RequestItemRecord[]
  grants: AccessGrantRecord[]
  submissions: SubmissionRecord[]
  responseItems: ResponseItemRecord[]
  drafts: DraftRecord[]
  snapshots: SnapshotRecord[]
  notifications: NotificationRecord[]
}

export function createInMemoryStores(): InMemoryStores {
  return {
    entities: new Map(),
    evaluations: new Map(),
    audit: [],
    outbox: [],
    claims: [],
    decisions: [],
    requests: [],
    requestItems: [],
    grants: [],
    submissions: [],
    snapshots: [],
    notifications: [],
    responseItems: [],
    drafts: [],
  }
}

/**
 * In-memory unit of work with commit-or-nothing semantics: writes are staged and
 * flushed to `stores` only if `fn` resolves; a throw discards the whole batch.
 */
export function inMemoryUnitOfWork(stores: InMemoryStores): UnitOfWork {
  return async (tenantId, fn) => {
    const stagedEntities: RegulatedEntity[] = []
    const stagedEvaluations: EntityScopeEvaluation[] = []
    const stagedAudit: AuditRecord[] = []
    const stagedOutbox: OutboxRecord[] = []
    const stagedClaims: ClaimRecord[] = []
    const stagedDecisions: ReviewDecisionRecord[] = []
    const claimStatusOverrides = new Map<
      string,
      { status: ClaimStatus; supersedesClaimId?: string | null }
    >()
    const stagedRequests: EvidenceRequestRecord[] = []
    const stagedItems: RequestItemRecord[] = []
    const stagedGrants: AccessGrantRecord[] = []
    const stagedSubmissions: SubmissionRecord[] = []
    const stagedResponseItems: ResponseItemRecord[] = []
    const stagedSnapshots: SnapshotRecord[] = []
    const requestStatusOverrides = new Map<string, RequestStatus>()
    const grantOverrides = new Map<string, { revokedAt?: string; usesInc?: number }>()
    const stagedDraftUpserts = new Map<string, DraftRecord>()
    const stagedDraftDeletes = new Set<string>()

    const allRequests = (): EvidenceRequestRecord[] =>
      [...stores.requests, ...stagedRequests].map((r) => {
        const s = requestStatusOverrides.get(r.id)
        return s ? { ...r, status: s } : r
      })
    const allGrants = (): AccessGrantRecord[] =>
      [...stores.grants, ...stagedGrants].map((g) => {
        const o = grantOverrides.get(g.id)
        return o
          ? { ...g, revokedAt: o.revokedAt ?? g.revokedAt, uses: g.uses + (o.usesInc ?? 0) }
          : g
      })

    const requests: RequestRepository = {
      async insertRequest(r) {
        if (r.tenantId !== tenantId) throw new Error('unit-of-work tenant mismatch')
        stagedRequests.push({ ...r })
      },
      async insertItem(i) {
        stagedItems.push({ ...i })
      },
      async getRequest(id) {
        return allRequests().find((r) => r.id === id && r.tenantId === tenantId) ?? null
      },
      async listRequestsByEntity(entityId) {
        return allRequests().filter((r) => r.tenantId === tenantId && r.entityId === entityId)
      },
      async listItems(requestId) {
        return [...stores.requestItems, ...stagedItems].filter(
          (i) => i.tenantId === tenantId && i.requestId === requestId,
        )
      },
      async setRequestStatus(id, status) {
        requestStatusOverrides.set(id, status)
      },
      async insertGrant(g) {
        stagedGrants.push({ ...g })
      },
      async listGrantsByRequest(requestId) {
        return allGrants().filter((g) => g.tenantId === tenantId && g.requestId === requestId)
      },
      async revokeGrant(id, at) {
        grantOverrides.set(id, { ...grantOverrides.get(id), revokedAt: at })
      },
      async bumpGrantUses(id) {
        const cur = grantOverrides.get(id)
        grantOverrides.set(id, { ...cur, usesInc: (cur?.usesInc ?? 0) + 1 })
      },
      async insertSubmission(s) {
        stagedSubmissions.push({ ...s })
      },
      async insertResponseItem(ri) {
        stagedResponseItems.push({ ...ri })
      },
      async listSubmissions(requestId) {
        return [...stores.submissions, ...stagedSubmissions].filter(
          (s) => s.tenantId === tenantId && s.requestId === requestId,
        )
      },
      async getSubmission(id) {
        return (
          [...stores.submissions, ...stagedSubmissions].find(
            (s) => s.id === id && s.tenantId === tenantId,
          ) ?? null
        )
      },
      async listResponseItems(submissionId) {
        return [...stores.responseItems, ...stagedResponseItems].filter(
          (ri) => ri.tenantId === tenantId && ri.submissionId === submissionId,
        )
      },
      async maxSubmissionVersion(requestId) {
        const v = [...stores.submissions, ...stagedSubmissions]
          .filter((s) => s.tenantId === tenantId && s.requestId === requestId)
          .map((s) => s.submissionVersion)
        return v.length > 0 ? Math.max(...v) : 0
      },
      async getDraft(requestId) {
        if (stagedDraftDeletes.has(requestId)) return null
        const staged = stagedDraftUpserts.get(requestId)
        if (staged) return staged
        return (
          stores.drafts.find((d) => d.requestId === requestId && d.tenantId === tenantId) ?? null
        )
      },
      async upsertDraft(d) {
        if (d.tenantId !== tenantId) throw new Error('unit-of-work tenant mismatch')
        stagedDraftDeletes.delete(d.requestId)
        stagedDraftUpserts.set(d.requestId, { ...d })
      },
      async deleteDraft(requestId) {
        stagedDraftUpserts.delete(requestId)
        stagedDraftDeletes.add(requestId)
      },
    }

    const allClaims = (): ClaimRecord[] =>
      [...stores.claims, ...stagedClaims].map((c) => {
        const o = claimStatusOverrides.get(c.id)
        if (!o) return c
        return {
          ...c,
          status: o.status,
          supersedesClaimId:
            o.supersedesClaimId === undefined ? c.supersedesClaimId : o.supersedesClaimId,
        }
      })

    const claims: ClaimRepository = {
      async insert(c) {
        if (c.tenantId !== tenantId) throw new Error('unit-of-work tenant mismatch')
        stagedClaims.push({ ...c })
      },
      async get(id) {
        return allClaims().find((c) => c.id === id && c.tenantId === tenantId) ?? null
      },
      async listByEntity(entityId) {
        return allClaims().filter((c) => c.tenantId === tenantId && c.entityId === entityId)
      },
      async setStatus(id, status, supersedesClaimId) {
        claimStatusOverrides.set(id, { status, supersedesClaimId })
      },
      async recordDecision(d) {
        if (d.tenantId !== tenantId) throw new Error('unit-of-work tenant mismatch')
        stagedDecisions.push({ ...d })
      },
      async maxRevision(entityId, controlKey) {
        const revs = allClaims()
          .filter(
            (c) =>
              c.tenantId === tenantId && c.entityId === entityId && c.controlKey === controlKey,
          )
          .map((c) => c.revision)
        return revs.length > 0 ? Math.max(...revs) : 0
      },
    }

    const allSnapshots = (): SnapshotRecord[] => [...stores.snapshots, ...stagedSnapshots]

    const snapshots: SnapshotRepository = {
      async insert(s) {
        if (s.tenantId !== tenantId) throw new Error('unit-of-work tenant mismatch')
        stagedSnapshots.push({ ...s })
      },
      async get(id) {
        return allSnapshots().find((s) => s.id === id && s.tenantId === tenantId) ?? null
      },
      async listByEntity(entityId) {
        return allSnapshots()
          .filter((s) => s.tenantId === tenantId && s.entityId === entityId)
          .map(({ document: _document, ...summary }) => summary)
          .reverse()
      },
    }

    const notificationReadOverrides = new Map<string, string>()
    let markAllReadAt: string | null = null
    const effectiveReadAt = (n: NotificationRecord): string | null =>
      notificationReadOverrides.get(n.id) ?? (n.readAt ? n.readAt : markAllReadAt) ?? null
    const tenantNotifications = (): NotificationRecord[] =>
      stores.notifications
        .filter((n) => n.tenantId === tenantId)
        .map((n) => ({ ...n, readAt: effectiveReadAt(n) }))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))

    const notifications: NotificationRepository = {
      async list(query) {
        const rows = tenantNotifications().filter((n) => !query.unreadOnly || n.readAt === null)
        return rows.slice(0, query.limit)
      },
      async countUnread() {
        return tenantNotifications().filter((n) => n.readAt === null).length
      },
      async markRead(id, at) {
        const n = stores.notifications.find((x) => x.id === id && x.tenantId === tenantId)
        if (!n || effectiveReadAt(n) !== null) return false
        notificationReadOverrides.set(id, at)
        return true
      },
      async markAllRead(at) {
        const n = tenantNotifications().filter((x) => x.readAt === null).length
        markAllReadAt = at
        return n
      },
    }

    const entities: EntityRepository = {
      async create(entity, evaluation) {
        if (entity.tenantId !== tenantId || evaluation.tenantId !== tenantId) {
          throw new Error('unit-of-work tenant mismatch')
        }
        stagedEntities.push(entity)
        stagedEvaluations.push(evaluation)
      },
      async get(id) {
        const entity = stores.entities.get(id) ?? stagedEntities.find((e) => e.id === id) ?? null
        if (!entity || entity.tenantId !== tenantId) return null
        const evaluation =
          stores.evaluations.get(entity.currentEvaluationId) ??
          stagedEvaluations.find((e) => e.id === entity.currentEvaluationId) ??
          null
        return evaluation ? { entity, evaluation } : null
      },
    }

    const uow: Uow = {
      tenantId,
      entities,
      claims,
      requests,
      snapshots,
      notifications,
      async audit(ev) {
        stagedAudit.push({
          id: `aud_${randomUUID()}`,
          seq: '', // assigned on flush
          tenantId,
          ...ev,
          metadata: ev.metadata ?? {},
        })
      },
      async enqueue(topic, payload) {
        stagedOutbox.push({
          id: `obx_${randomUUID()}`,
          tenantId,
          topic,
          payload,
          createdAt: new Date().toISOString(),
          publishedAt: null,
          attempts: 0,
        })
      },
      async queryAudit(q) {
        let rows = stores.audit.filter((a) => a.tenantId === tenantId)
        if (q.targetType) rows = rows.filter((a) => a.targetType === q.targetType)
        if (q.targetId) rows = rows.filter((a) => a.targetId === q.targetId)
        if (q.action) rows = rows.filter((a) => a.action === q.action)
        if (q.since) rows = rows.filter((a) => a.occurredAt >= q.since!)
        rows = [...rows].sort((a, b) => Number(b.seq) - Number(a.seq))
        if (q.before) rows = rows.filter((a) => Number(a.seq) < Number(q.before))
        return rows.slice(0, q.limit)
      },
    }

    const result = await fn(uow)

    for (const e of stagedEntities) stores.entities.set(e.id, e)
    for (const e of stagedEvaluations) stores.evaluations.set(e.id, e)
    for (const a of stagedAudit) {
      a.seq = String(stores.audit.length + 1)
      stores.audit.push(a)
    }
    stores.outbox.push(...stagedOutbox)
    for (const c of stagedClaims) stores.claims.push(c)
    for (const d of stagedDecisions) stores.decisions.push(d)
    for (const [id, o] of claimStatusOverrides) {
      const c = stores.claims.find((x) => x.id === id)
      if (c) {
        c.status = o.status
        if (o.supersedesClaimId !== undefined) c.supersedesClaimId = o.supersedesClaimId
      }
    }
    for (const r of stagedRequests) stores.requests.push(r)
    for (const i of stagedItems) stores.requestItems.push(i)
    for (const g of stagedGrants) stores.grants.push(g)
    for (const s of stagedSubmissions) stores.submissions.push(s)
    for (const ri of stagedResponseItems) stores.responseItems.push(ri)
    for (const s of stagedSnapshots) stores.snapshots.push(s)
    for (const n of stores.notifications) {
      if (n.tenantId !== tenantId) continue
      const at = notificationReadOverrides.get(n.id) ?? (n.readAt === null ? markAllReadAt : null)
      if (at && n.readAt === null) n.readAt = at
    }
    for (const [id, s] of requestStatusOverrides) {
      const r = stores.requests.find((x) => x.id === id)
      if (r) r.status = s
    }
    for (const [id, o] of grantOverrides) {
      const g = stores.grants.find((x) => x.id === id)
      if (g) {
        if (o.revokedAt !== undefined) g.revokedAt = o.revokedAt
        if (o.usesInc) g.uses += o.usesInc
      }
    }
    if (stagedDraftDeletes.size > 0) {
      stores.drafts = stores.drafts.filter((d) => !stagedDraftDeletes.has(d.requestId))
    }
    for (const [requestId, d] of stagedDraftUpserts) {
      const existing = stores.drafts.find((x) => x.requestId === requestId)
      if (existing) {
        existing.payload = d.payload
        existing.updatedAt = d.updatedAt
      } else {
        stores.drafts.push(d)
      }
    }
    return result
  }
}
