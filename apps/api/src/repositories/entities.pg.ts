import type { PoolClient } from 'pg'
import type {
  ControlApplicabilityRecord,
  EntityFacts,
  EntityScopeEvaluation,
  RegulatedEntity,
} from '@rre/domain'
import type { EntityRepository } from '../services/entities.js'

interface EntityRow {
  id: string
  tenant_id: string
  pack_key: string
  name: string
  entity_identifier: string
  entity_kind: 'product' | 'service'
  created_at: Date
  created_by: string
  current_evaluation_id: string
}

interface EvaluationRow {
  id: string
  entity_id: string
  tenant_id: string
  pack_key: string
  snapshot_key: string
  version: number
  facts: EntityFacts
  results: ControlApplicabilityRecord[]
  evaluated_at: Date
  evaluated_by: string
  hash: string
}

function toEntity(r: EntityRow): RegulatedEntity {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    packKey: r.pack_key,
    name: r.name,
    entityIdentifier: r.entity_identifier,
    entityKind: r.entity_kind,
    createdAt: r.created_at.toISOString(),
    createdBy: r.created_by,
    currentEvaluationId: r.current_evaluation_id,
  }
}

function toEvaluation(r: EvaluationRow): EntityScopeEvaluation {
  return {
    id: r.id,
    entityId: r.entity_id,
    tenantId: r.tenant_id,
    packKey: r.pack_key,
    snapshotKey: r.snapshot_key,
    version: r.version,
    facts: r.facts,
    results: r.results,
    evaluatedAt: r.evaluated_at.toISOString(),
    evaluatedBy: r.evaluated_by,
    hash: r.hash,
  }
}

/**
 * Tenant-scoped persistence for regulated entities. Constructed by the unit of
 * work with a client already inside a transaction that has `app.tenant_id` set,
 * so RLS enforces isolation; the `tenant_id = $` predicate is defense in depth.
 */
export class PgEntityRepository implements EntityRepository {
  constructor(
    private readonly db: PoolClient,
    private readonly tenantId: string,
  ) {}

  async create(entity: RegulatedEntity, evaluation: EntityScopeEvaluation): Promise<void> {
    await this.db.query(
      `INSERT INTO regulated_entity
         (id, tenant_id, pack_key, name, entity_identifier, entity_kind,
          created_at, created_by, current_evaluation_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        entity.id,
        entity.tenantId,
        entity.packKey,
        entity.name,
        entity.entityIdentifier,
        entity.entityKind,
        entity.createdAt,
        entity.createdBy,
        entity.currentEvaluationId,
      ],
    )
    await this.db.query(
      `INSERT INTO entity_scope_evaluation
         (id, entity_id, tenant_id, pack_key, snapshot_key, version,
          facts, results, evaluated_at, evaluated_by, hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        evaluation.id,
        evaluation.entityId,
        evaluation.tenantId,
        evaluation.packKey,
        evaluation.snapshotKey,
        evaluation.version,
        JSON.stringify(evaluation.facts),
        JSON.stringify(evaluation.results),
        evaluation.evaluatedAt,
        evaluation.evaluatedBy,
        evaluation.hash,
      ],
    )
  }

  async reEvaluate(entityId: string, evaluation: EntityScopeEvaluation): Promise<void> {
    await this.db.query(
      `INSERT INTO entity_scope_evaluation
         (id, entity_id, tenant_id, pack_key, snapshot_key, version,
          facts, results, evaluated_at, evaluated_by, hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        evaluation.id,
        evaluation.entityId,
        evaluation.tenantId,
        evaluation.packKey,
        evaluation.snapshotKey,
        evaluation.version,
        JSON.stringify(evaluation.facts),
        JSON.stringify(evaluation.results),
        evaluation.evaluatedAt,
        evaluation.evaluatedBy,
        evaluation.hash,
      ],
    )
    await this.db.query(
      `UPDATE regulated_entity SET current_evaluation_id = $1 WHERE id = $2 AND tenant_id = $3`,
      [evaluation.id, entityId, this.tenantId],
    )
  }

  async list(): Promise<Array<{ entity: RegulatedEntity; evaluation: EntityScopeEvaluation }>> {
    const entityRes = await this.db.query<EntityRow>(
      `SELECT * FROM regulated_entity WHERE tenant_id = $1 ORDER BY created_at`,
      [this.tenantId],
    )
    if (entityRes.rows.length === 0) return []

    const evalRes = await this.db.query<EvaluationRow>(
      `SELECT * FROM entity_scope_evaluation WHERE tenant_id = $1 AND id = ANY($2::text[])`,
      [this.tenantId, entityRes.rows.map((e) => e.current_evaluation_id)],
    )
    const evalById = new Map(evalRes.rows.map((ev) => [ev.id, toEvaluation(ev)]))

    return entityRes.rows.flatMap((e) => {
      const evaluation = evalById.get(e.current_evaluation_id)
      return evaluation ? [{ entity: toEntity(e), evaluation }] : []
    })
  }

  async get(
    id: string,
  ): Promise<{ entity: RegulatedEntity; evaluation: EntityScopeEvaluation } | null> {
    const entityRes = await this.db.query<EntityRow>(
      `SELECT * FROM regulated_entity WHERE id = $1 AND tenant_id = $2`,
      [id, this.tenantId],
    )
    const row = entityRes.rows[0]
    if (!row) return null

    const evalRes = await this.db.query<EvaluationRow>(
      `SELECT * FROM entity_scope_evaluation WHERE id = $1 AND tenant_id = $2`,
      [row.current_evaluation_id, this.tenantId],
    )
    const evalRow = evalRes.rows[0]
    if (!evalRow) return null

    return { entity: toEntity(row), evaluation: toEvaluation(evalRow) }
  }
}
