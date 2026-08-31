import { createHash, randomUUID } from 'node:crypto'
import type { CreateEntityRequest } from '@rre/contracts'
import { evaluateApplicability, validateEntityFacts, type FactIssue } from '@rre/control-catalog'
import {
  canonicalJson,
  diffControlSets,
  diffEvaluations,
  readinessForEntity,
  summariseApplicability,
  type ApplicabilitySummary,
  type EntityFacts,
  type EntityScopeEvaluation,
  type EntityStatus,
  type EvaluationDiff,
  type EvaluationDigestInput,
  type ReadinessCounts,
  type RegulatedEntity,
} from '@rre/domain'
import type { AuthContext } from '../auth.js'
import type { PackRegistry } from '../pack-registry.js'
import type { UnitOfWork } from '../db/uow.js'
import { approvedClaimByControl, claimStateByControl, evidencedClaimIds } from './claims.js'
import { activeOverrides } from './overrides.js'

/** `sha256:<hex>` over the canonical form of a scope evaluation (engine AC-003). */
function computeEvaluationHash(input: EvaluationDigestInput): string {
  return `sha256:${createHash('sha256').update(canonicalJson(input)).digest('hex')}`
}

/** Transaction-scoped persistence port for regulated entities (the caller owns the transaction). */
export interface EntityRepository {
  create(entity: RegulatedEntity, evaluation: EntityScopeEvaluation): Promise<void>
  get(id: string): Promise<{ entity: RegulatedEntity; evaluation: EntityScopeEvaluation } | null>
  /** Persist a new scope evaluation and point the entity at it. Prior evaluations stay. */
  reEvaluate(entityId: string, evaluation: EntityScopeEvaluation): Promise<void>
  /** Every entity in the tenant with its current evaluation. */
  list(): Promise<Array<{ entity: RegulatedEntity; evaluation: EntityScopeEvaluation }>>
}

export type CreateEntityFailure =
  | { code: 'PACK_NOT_FOUND'; message: string }
  | { code: 'PACK_NOT_LOADED'; message: string }
  | { code: 'KIND_MISMATCH'; message: string }
  | { code: 'INVALID_FACTS'; message: string; issues: FactIssue[] }
  | { code: 'QUOTA_EXCEEDED'; message: string }

/** The billing check EntityService uses — `BillingService` satisfies this. */
export interface EntityQuota {
  assertCanAdd(tenantId: string, resource: 'entities'): Promise<{ ok: boolean; message?: string }>
}

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
  /** Pack-authored guidance: what good evidence for this control looks like. */
  evidenceExpectation: string | null
  applicability: string
  reason?: string
  readiness: string
  approvedValue: string | null
  approvedUnit: string | null
  pendingClaims: number
  evidenceCount: number
  /** The applicability the evaluation produced, when an override is in effect. */
  originalApplicability: string | null
  overrideRationale: string | null
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
    private readonly quota?: EntityQuota,
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

    if (this.quota) {
      const q = await this.quota.assertCanAdd(auth.tenantId, 'entities')
      if (!q.ok) {
        return { ok: false, code: 'QUOTA_EXCEEDED', message: q.message ?? 'entity limit reached' }
      }
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

  /**
   * Re-run applicability for an entity — optionally with corrected scope facts,
   * otherwise against the current pack rules — producing a new evaluation
   * version. Claims and evidence hang off the entity + control key, so they are
   * untouched. Returns a `ControlChange`-style diff of what moved (TRD §7.4).
   */
  async reEvaluate(
    auth: AuthContext,
    entityId: string,
    input: { facts?: Record<string, string | number | boolean> } = {},
    now: Date = new Date(),
  ): Promise<
    | {
        ok: true
        evaluationId: string
        version: number
        snapshotKey: string
        diff: EvaluationDiff
      }
    | { ok: false; code: 'ENTITY_NOT_FOUND' | 'PACK_NOT_LOADED'; message: string }
    | { ok: false; code: 'INVALID_FACTS'; message: string; issues: FactIssue[] }
  > {
    return this.uow(auth.tenantId, async (u) => {
      const found = await u.entities.get(entityId)
      if (!found) {
        return { ok: false, code: 'ENTITY_NOT_FOUND', message: `entity ${entityId} not found` }
      }
      const pack = this.packs.get(found.entity.packKey)
      if (!pack?.loaded || !pack.valid) {
        return {
          ok: false,
          code: 'PACK_NOT_LOADED',
          message: `pack "${found.entity.packKey}" is not valid`,
        }
      }

      const facts: EntityFacts = {
        ...found.evaluation.facts,
        ...(input.facts ?? {}),
        entityKind: found.entity.entityKind,
      }
      const issues = validateEntityFacts(pack.loaded.entityFacts, facts)
      if (issues.length > 0) {
        return { ok: false, code: 'INVALID_FACTS', message: 'entity facts are invalid', issues }
      }

      const snapshotKey = pack.loaded.manifest.snapshotKey
      const controls = pack.loaded.controls.map((c) => ({ key: c.key, family: c.family }))
      const results = evaluateApplicability(pack.loaded.applicability, controls, facts, {
        snapshotKey,
      })

      const at = now.toISOString()
      const evaluation: EntityScopeEvaluation = {
        id: `eval_${randomUUID()}`,
        entityId,
        tenantId: auth.tenantId,
        packKey: found.entity.packKey,
        snapshotKey,
        version: found.evaluation.version + 1,
        facts,
        results,
        evaluatedAt: at,
        evaluatedBy: auth.actor,
        hash: computeEvaluationHash({
          packKey: found.entity.packKey,
          snapshotKey,
          facts,
          results,
        }),
      }
      const diff = diffEvaluations(found.evaluation.results, results)

      await u.entities.reEvaluate(entityId, evaluation)
      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: 'entity.re_evaluated',
        targetType: 'regulated_entity',
        targetId: entityId,
        occurredAt: at,
        metadata: {
          fromVersion: found.evaluation.version,
          toVersion: evaluation.version,
          factsChanged: Boolean(input.facts && Object.keys(input.facts).length > 0),
          added: diff.added.length,
          removed: diff.removed.length,
          applicabilityChanged: diff.applicabilityChanged.length,
        },
      })
      await u.enqueue('entity.readiness_evaluated', {
        entityId,
        tenantId: auth.tenantId,
        packKey: found.entity.packKey,
        snapshotKey,
        evaluationHash: evaluation.hash,
      })

      return {
        ok: true,
        evaluationId: evaluation.id,
        version: evaluation.version,
        snapshotKey,
        diff,
      }
    })
  }

  async matrix(
    auth: AuthContext,
    id: string,
    now: Date = new Date(),
  ): Promise<EntityMatrix | null> {
    return this.uow(auth.tenantId, async (u) => {
      const found = await u.entities.get(id)
      if (!found) return null

      const pack = this.packs.get(found.entity.packKey)
      const meta = new Map((pack?.loaded?.controls ?? []).map((c) => [c.key, c]))
      const overrides = activeOverrides(await u.overrides.listByEntity(id), now)
      const effective = (control: string, evaluated: string): string =>
        overrides.get(control)?.result ?? evaluated

      const claims = await u.claims.listByEntity(id)
      const evidence = await u.claims.listEvidenceByEntity(id)
      const evidencedIds = evidencedClaimIds(evidence)
      const claimState = claimStateByControl(claims, evidencedIds)
      const approved = approvedClaimByControl(claims)
      const evidenceCountByControl = new Map<string, number>()
      for (const e of evidence) {
        const claim = claims.find((c) => c.id === e.claimId)
        if (claim) {
          evidenceCountByControl.set(
            claim.controlKey,
            (evidenceCountByControl.get(claim.controlKey) ?? 0) + 1,
          )
        }
      }

      const effectiveResults = found.evaluation.results.map((r) => ({
        control: r.control,
        result: effective(r.control, r.result) as (typeof r)['result'],
      }))
      const readiness = readinessForEntity(
        effectiveResults.map((r) => ({ control: r.control, applicability: r.result })),
        claimState,
      )
      const readinessByControl = new Map(readiness.perControl.map((c) => [c.control, c.readiness]))

      const rows: MatrixRow[] = found.evaluation.results.map((r) => {
        const c = meta.get(r.control)
        const approvedClaim = approved.get(r.control) ?? null
        const ov = overrides.get(r.control) ?? null
        return {
          control: r.control,
          title: c?.title ?? r.control,
          family: c?.family ?? 'unknown',
          standardClause: c?.standardClause ?? null,
          wcagSc: c?.wcagSc ?? null,
          accessClassDefault: c?.accessClassDefault ?? 'PUBLIC_CANDIDATE',
          evidenceExpectation: c?.evidenceExpectation ?? null,
          applicability: ov?.result ?? r.result,
          reason: ov ? `overridden: ${ov.rationale}` : r.reason,
          readiness: readinessByControl.get(r.control) ?? 'MISSING',
          approvedValue: approvedClaim?.value ?? null,
          approvedUnit: approvedClaim?.unit ?? null,
          pendingClaims: claimState.get(r.control)?.pending ?? 0,
          evidenceCount: evidenceCountByControl.get(r.control) ?? 0,
          originalApplicability: ov ? r.result : null,
          overrideRationale: ov?.rationale ?? null,
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
        summary: summariseApplicability(effectiveResults),
        entityStatus: readiness.entityStatus,
        readinessCounts: readiness.counts,
        rows,
      }
    })
  }

  /**
   * Which entities on this pack are evaluated against an older control snapshot
   * than the one currently installed, and what changed for each (TRD §7.4).
   * Adopting the change is `reEvaluate` — this endpoint is the "who is affected"
   * view that comes first.
   */
  async snapshotImpact(
    auth: AuthContext,
    packKey: string,
  ): Promise<
    | { ok: true; report: SnapshotImpactReport }
    | { ok: false; code: 'PACK_NOT_FOUND' | 'PACK_NOT_LOADED'; message: string }
  > {
    const pack = this.packs.get(packKey)
    if (!pack) return { ok: false, code: 'PACK_NOT_FOUND', message: `no pack "${packKey}"` }
    if (!pack.loaded || !pack.valid) {
      return { ok: false, code: 'PACK_NOT_LOADED', message: `pack "${packKey}" is not valid` }
    }
    const currentSnapshotKey = pack.loaded.manifest.snapshotKey
    const currentControls = pack.loaded.controls.map((c) => c.key)

    return this.uow(auth.tenantId, async (u) => {
      const entities = (await u.entities.list()).filter((e) => e.entity.packKey === packKey)
      let upToDate = 0
      const impacted: ImpactedEntity[] = []

      for (const { entity, evaluation } of entities) {
        if (evaluation.snapshotKey === currentSnapshotKey) {
          upToDate++
          continue
        }
        const diff = diffControlSets(
          evaluation.results.map((r) => r.control),
          currentControls,
        )
        const removedSet = new Set(diff.removed)
        const claims = await u.claims.listByEntity(entity.id)
        const orphanedClaims = claims.filter(
          (c) => c.status === 'APPROVED' && removedSet.has(c.controlKey),
        ).length
        impacted.push({
          entityId: entity.id,
          name: entity.name,
          snapshotKey: evaluation.snapshotKey,
          evaluationVersion: evaluation.version,
          addedControls: diff.added,
          removedControls: diff.removed,
          orphanedClaims,
        })
      }

      return { ok: true, report: { packKey, currentSnapshotKey, upToDate, impacted } }
    })
  }

  /**
   * Every entity in the workspace with its current evaluation and readiness
   * roll-up (newest first) — the dashboard view (engine TRD §7.1).
   */
  async list(auth: AuthContext, now: Date = new Date()): Promise<EntitySummary[]> {
    return this.uow(auth.tenantId, async (u) => {
      const rows = await u.entities.list()
      const out: EntitySummary[] = []
      for (const { entity, evaluation } of rows) {
        const overrides = activeOverrides(await u.overrides.listByEntity(entity.id), now)
        const claims = await u.claims.listByEntity(entity.id)
        const evidence = await u.claims.listEvidenceByEntity(entity.id)
        const claimState = claimStateByControl(claims, evidencedClaimIds(evidence))
        const readiness = readinessForEntity(
          evaluation.results.map((r) => ({
            control: r.control,
            applicability: overrides.get(r.control)?.result ?? r.result,
          })),
          claimState,
        )
        out.push({
          id: entity.id,
          name: entity.name,
          entityIdentifier: entity.entityIdentifier,
          packKey: entity.packKey,
          entityKind: entity.entityKind,
          createdAt: entity.createdAt,
          snapshotKey: evaluation.snapshotKey,
          evaluationVersion: evaluation.version,
          entityStatus: readiness.entityStatus,
          readinessCounts: readiness.counts,
        })
      }
      return out.sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
      )
    })
  }
}

export interface EntitySummary {
  id: string
  name: string
  entityIdentifier: string
  packKey: string
  entityKind: string
  createdAt: string
  snapshotKey: string
  evaluationVersion: number
  entityStatus: EntityStatus
  readinessCounts: ReadinessCounts
}

export interface ImpactedEntity {
  entityId: string
  name: string
  snapshotKey: string
  evaluationVersion: number
  addedControls: string[]
  removedControls: string[]
  orphanedClaims: number
}

export interface SnapshotImpactReport {
  packKey: string
  currentSnapshotKey: string
  upToDate: number
  impacted: ImpactedEntity[]
}
