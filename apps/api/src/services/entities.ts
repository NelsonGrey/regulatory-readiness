import { createHash, randomUUID } from 'node:crypto'
import type { CreateEntityRequest } from '@rre/contracts'
import { evaluateApplicability, validateEntityFacts, type FactIssue } from '@rre/control-catalog'
import {
  canonicalJson,
  summariseApplicability,
  type ApplicabilitySummary,
  type EntityFacts,
  type EntityScopeEvaluation,
  type EvaluationDigestInput,
  type RegulatedEntity,
} from '@rre/domain'
import type { AuthContext } from '../auth.js'
import type { PackRegistry } from '../pack-registry.js'

/** `sha256:<hex>` over the canonical form of a scope evaluation (engine AC-003). */
function computeEvaluationHash(input: EvaluationDigestInput): string {
  return `sha256:${createHash('sha256').update(canonicalJson(input)).digest('hex')}`
}

/**
 * Persistence port. `InMemoryEntityRepository` is a placeholder for the Postgres
 * repository (tenant-scoped, RLS-backed) that lands with the DB slice.
 */
export interface EntityRepository {
  create(entity: RegulatedEntity, evaluation: EntityScopeEvaluation): Promise<void>
  get(
    tenantId: string,
    id: string,
  ): Promise<{ entity: RegulatedEntity; evaluation: EntityScopeEvaluation } | null>
}

export class InMemoryEntityRepository implements EntityRepository {
  private readonly entities = new Map<string, RegulatedEntity>()
  private readonly evaluations = new Map<string, EntityScopeEvaluation>()

  async create(entity: RegulatedEntity, evaluation: EntityScopeEvaluation): Promise<void> {
    this.entities.set(entity.id, entity)
    this.evaluations.set(evaluation.id, evaluation)
  }

  async get(
    tenantId: string,
    id: string,
  ): Promise<{ entity: RegulatedEntity; evaluation: EntityScopeEvaluation } | null> {
    const entity = this.entities.get(id)
    if (!entity || entity.tenantId !== tenantId) return null
    const evaluation = this.evaluations.get(entity.currentEvaluationId)
    if (!evaluation) return null
    return { entity, evaluation }
  }
}

export type CreateEntityFailure =
  | { code: 'PACK_NOT_FOUND'; message: string }
  | { code: 'PACK_NOT_LOADED'; message: string }
  | { code: 'KIND_MISMATCH'; message: string }
  | { code: 'INVALID_FACTS'; message: string; issues: FactIssue[] }

export type CreateEntityResult =
  | { ok: true; entity: RegulatedEntity; evaluation: EntityScopeEvaluation }
  | ({ ok: false } & CreateEntityFailure)

export interface MatrixRow {
  control: string
  title: string
  family: string
  standardClause: string | null
  wcagSc: string | null
  accessClassDefault: string
  applicability: string
  reason?: string
}

export interface EntityMatrix {
  entity: RegulatedEntity
  evaluation: Pick<EntityScopeEvaluation, 'id' | 'snapshotKey' | 'evaluatedAt' | 'hash' | 'version'>
  summary: ApplicabilitySummary
  rows: MatrixRow[]
}

export class EntityService {
  constructor(
    private readonly repo: EntityRepository,
    private readonly packs: PackRegistry,
  ) {}

  async create(
    auth: AuthContext,
    req: CreateEntityRequest,
    now: Date = new Date(),
  ): Promise<CreateEntityResult> {
    const pack = this.packs.get(req.packKey)
    if (!pack) return { ok: false, code: 'PACK_NOT_FOUND', message: `no pack "${req.packKey}"` }
    if (!pack.loaded || !pack.valid) {
      return { ok: false, code: 'PACK_NOT_LOADED', message: `pack "${req.packKey}" is not valid` }
    }

    if (req.facts.entityKind !== undefined && req.facts.entityKind !== req.entityKind) {
      return {
        ok: false,
        code: 'KIND_MISMATCH',
        message: 'facts.entityKind does not match the entityKind field',
      }
    }

    const facts: EntityFacts = { ...req.facts, entityKind: req.entityKind }

    const issues = validateEntityFacts(pack.loaded.entityFacts, facts)
    if (issues.length > 0) {
      return { ok: false, code: 'INVALID_FACTS', message: 'entity facts are invalid', issues }
    }

    const snapshotKey = pack.loaded.manifest.snapshotKey
    const controls = pack.loaded.controls.map((c) => ({ key: c.key, family: c.family }))
    const results = evaluateApplicability(pack.loaded.applicability, controls, facts, {
      snapshotKey,
    })

    const entityId = `ent_${randomUUID()}`
    const evaluationId = `eval_${randomUUID()}`
    const at = now.toISOString()

    const evaluation: EntityScopeEvaluation = {
      id: evaluationId,
      entityId,
      tenantId: auth.tenantId,
      packKey: req.packKey,
      snapshotKey,
      version: 1,
      facts,
      results,
      evaluatedAt: at,
      evaluatedBy: auth.actor,
      hash: computeEvaluationHash({ packKey: req.packKey, snapshotKey, facts, results }),
    }

    const entity: RegulatedEntity = {
      id: entityId,
      tenantId: auth.tenantId,
      packKey: req.packKey,
      name: req.name,
      entityIdentifier: req.entityIdentifier,
      entityKind: req.entityKind,
      createdAt: at,
      createdBy: auth.actor,
      currentEvaluationId: evaluationId,
    }

    await this.repo.create(entity, evaluation)
    return { ok: true, entity, evaluation }
  }

  async matrix(auth: AuthContext, id: string): Promise<EntityMatrix | null> {
    const found = await this.repo.get(auth.tenantId, id)
    if (!found) return null

    const pack = this.packs.get(found.entity.packKey)
    const meta = new Map((pack?.loaded?.controls ?? []).map((c) => [c.key, c]))

    const rows: MatrixRow[] = found.evaluation.results.map((r) => {
      const c = meta.get(r.control)
      return {
        control: r.control,
        title: c?.title ?? r.control,
        family: c?.family ?? 'unknown',
        standardClause: c?.standardClause ?? null,
        wcagSc: c?.wcagSc ?? null,
        accessClassDefault: c?.accessClassDefault ?? 'PUBLIC_CANDIDATE',
        applicability: r.result,
        reason: r.reason,
      }
    })

    return {
      entity: found.entity,
      evaluation: {
        id: found.evaluation.id,
        snapshotKey: found.evaluation.snapshotKey,
        evaluatedAt: found.evaluation.evaluatedAt,
        hash: found.evaluation.hash,
        version: found.evaluation.version,
      },
      summary: summariseApplicability(found.evaluation.results),
      rows,
    }
  }
}
