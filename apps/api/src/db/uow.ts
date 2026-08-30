import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import type { EntityScopeEvaluation, RegulatedEntity } from '@rre/domain'
import { withTenant } from './pool.js'
import { PgEntityRepository } from '../repositories/entities.pg.js'
import type { EntityRepository } from '../services/entities.js'

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
  tenantId: string
  metadata: Record<string, unknown>
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
  audit(event: AuditInput): Promise<void>
  enqueue(topic: string, payload: unknown): Promise<void>
}

export type UnitOfWork = <T>(tenantId: string, fn: (uow: Uow) => Promise<T>) => Promise<T>

// --- Postgres ---------------------------------------------------------------

export function pgUnitOfWork(pool: Pool): UnitOfWork {
  return (tenantId, fn) =>
    withTenant(pool, tenantId, async (client) => {
      const uow: Uow = {
        tenantId,
        entities: new PgEntityRepository(client, tenantId),
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
      }
      return fn(uow)
    })
}

// --- In-memory ------------------------------------------------------------------

export interface InMemoryStores {
  entities: Map<string, RegulatedEntity>
  evaluations: Map<string, EntityScopeEvaluation>
  audit: AuditRecord[]
  outbox: OutboxRecord[]
}

export function createInMemoryStores(): InMemoryStores {
  return { entities: new Map(), evaluations: new Map(), audit: [], outbox: [] }
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
      async audit(ev) {
        stagedAudit.push({
          id: `aud_${randomUUID()}`,
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
    }

    const result = await fn(uow)

    for (const e of stagedEntities) stores.entities.set(e.id, e)
    for (const e of stagedEvaluations) stores.evaluations.set(e.id, e)
    stores.audit.push(...stagedAudit)
    stores.outbox.push(...stagedOutbox)
    return result
  }
}
