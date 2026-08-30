import { createHash, randomUUID } from 'node:crypto'
import type { CreateEntityRequest } from '@rre/contracts'
import { evaluateApplicability, validateEntityFacts, type FactIssue } from '@rre/control-catalog'
import {
  canonicalJson,
  readinessForEntity,
  summariseApplicability,
  type ApplicabilitySummary,
  type EntityFacts,
  type EntityScopeEvaluation,
  type EntityStatus,
  type EvaluationDigestInput,
  type ReadinessCounts,
  type RegulatedEntity,
} from '@rre/domain'
import type { AuthContext } from '../auth.js'
import type { PackRegistry } from '../pack-registry.js'
import type { UnitOfWork } from '../db/uow.js'
import { approvedClaimByControl, claimStateByControl } from './claims.js'

/** `sha256:<hex>` over the canonical form of a scope evaluation (engine AC-003). */
function computeEvaluationHash(input: EvaluationDigestInput): string {
  return `sha256:${createHash('sha256').update(canonicalJson(input)).digest('hex')}`
}

/** Transaction-scoped persistence port for regulated entities (the caller owns the transaction). */
export interface EntityRepository {
  create(entity: RegulatedEntity, evaluation: EntityScopeEvaluation): Promise<void>
  get(id: string): Promise<{ entity: RegulatedEntity; evaluation: EntityScopeEvaluation } | null>
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
  readiness: string
  approvedValue: string | null
  approvedUnit: string | null
  pendingClaims: number
}

export interface EntityMatrix {
  entity: RegulatedEntity
  evaluation: Pick<EntityScopeEvaluation, 'id' | 'snapshotKey' | 'evaluatedAt' | 'hash' | 'version'>
  summary: ApplicabilitySummary
  entityStatus: EntityStatus
  readinessCounts: ReadinessCounts
  rows: MatrixRow[]
}

export class EntityService {
  constructor(
    private readonly uow: UnitOfWork,
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
    const summary = summariseApplicability(results)

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

    return this.uow(auth.tenantId, async (u) => {
      await u.entities.create(entity, evaluation)
      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: 'entity.created',
        targetType: 'regulated_entity',
        targetId: entity.id,
        occurredAt: at,
        metadata: {
          packKey: req.packKey,
          snapshotKey,
          evaluationHash: evaluation.hash,
          requiredNow: summary.requiredNow,
          notApplicable: summary.notApplicable,
        },
      })
      await u.enqueue('entity.readiness_evaluated', {
        entityId: entity.id,
        tenantId: auth.tenantId,
        packKey: req.packKey,
        snapshotKey,
        evaluationHash: evaluation.hash,
        summary,
      })
      return { ok: true, entity, evaluation } satisfies CreateEntityResult
    })
  }

  async matrix(auth: AuthContext, id: string): Promise<EntityMatrix | null> {
    return this.uow(auth.tenantId, async (u) => {
      const found = await u.entities.get(id)
      if (!found) return null

      const pack = this.packs.get(found.entity.packKey)
      const meta = new Map((pack?.loaded?.controls ?? []).map((c) => [c.key, c]))

      const claims = await u.claims.listByEntity(id)
      const claimState = claimStateByControl(claims)
      const approved = approvedClaimByControl(claims)

      const readiness = readinessForEntity(
        found.evaluation.results.map((r) => ({ control: r.control, applicability: r.result })),
        claimState,
      )
      const readinessByControl = new Map(readiness.perControl.map((c) => [c.control, c.readiness]))

      const rows: MatrixRow[] = found.evaluation.results.map((r) => {
        const c = meta.get(r.control)
        const approvedClaim = approved.get(r.control) ?? null
        return {
          control: r.control,
          title: c?.title ?? r.control,
          family: c?.family ?? 'unknown',
          standardClause: c?.standardClause ?? null,
          wcagSc: c?.wcagSc ?? null,
          accessClassDefault: c?.accessClassDefault ?? 'PUBLIC_CANDIDATE',
          applicability: r.result,
          reason: r.reason,
          readiness: readinessByControl.get(r.control) ?? 'MISSING',
          approvedValue: approvedClaim?.value ?? null,
          approvedUnit: approvedClaim?.unit ?? null,
          pendingClaims: claimState.get(r.control)?.pending ?? 0,
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
        entityStatus: readiness.entityStatus,
        readinessCounts: readiness.counts,
        rows,
      }
    })
  }
}
