import { randomUUID } from 'node:crypto'
import {
  REVIEW_DECISIONS,
  type ClaimOrigin,
  type ClaimStatus,
  type ControlClaimState,
  type ReviewDecisionKind,
} from '@rre/domain'
import type { AuthContext } from '../auth.js'
import type { PackRegistry } from '../pack-registry.js'
import type { UnitOfWork } from '../db/uow.js'

export interface ClaimRecord {
  id: string
  tenantId: string
  entityId: string
  controlKey: string
  packKey: string
  origin: ClaimOrigin
  revision: number
  supersedesClaimId: string | null
  status: ClaimStatus
  value: string
  unit: string | null
  methodContext: string | null
  asOfDate: string | null
  note: string | null
  evidenceUrl: string | null
  assertedBy: string
  assertedAt: string
}

export interface ReviewDecisionRecord {
  id: string
  tenantId: string
  claimId: string
  decision: ReviewDecisionKind
  reason: string | null
  reviewer: string
  decidedAt: string
}

/** Transaction-scoped persistence port for claims + review decisions. */
export interface ClaimRepository {
  insert(claim: ClaimRecord): Promise<void>
  get(id: string): Promise<ClaimRecord | null>
  listByEntity(entityId: string): Promise<ClaimRecord[]>
  setStatus(id: string, status: ClaimStatus, supersedesClaimId?: string | null): Promise<void>
  recordDecision(decision: ReviewDecisionRecord): Promise<void>
  maxRevision(entityId: string, controlKey: string): Promise<number>
}

/** Roll up a claim list into per-control approved/pending counts (engine TRD §13). */
export function claimStateByControl(
  claims: readonly ClaimRecord[],
): Map<string, ControlClaimState> {
  const map = new Map<string, ControlClaimState>()
  for (const c of claims) {
    const s = map.get(c.controlKey) ?? { approved: 0, pending: 0 }
    if (c.status === 'APPROVED') s.approved++
    if (c.status === 'PENDING_REVIEW' || c.status === 'ASSERTED') s.pending++
    map.set(c.controlKey, s)
  }
  return map
}

export function approvedClaimByControl(claims: readonly ClaimRecord[]): Map<string, ClaimRecord> {
  const map = new Map<string, ClaimRecord>()
  for (const c of claims) if (c.status === 'APPROVED') map.set(c.controlKey, c)
  return map
}

export interface AssertClaimInput {
  value: string
  unit?: string
  methodContext?: string
  asOfDate?: string
  origin?: ClaimOrigin
  note?: string
  evidenceUrl?: string
}

export interface DecideInput {
  decision: ReviewDecisionKind
  reason?: string
}

export type AssertResult =
  | { ok: true; claim: ClaimRecord }
  | {
      ok: false
      code: 'ENTITY_NOT_FOUND' | 'UNKNOWN_CONTROL' | 'CONTROL_NOT_APPLICABLE'
      message: string
    }

export type DecideResult =
  | { ok: true; claim: ClaimRecord }
  | {
      ok: false
      code: 'CLAIM_NOT_FOUND' | 'REASON_REQUIRED' | 'NOT_PENDING' | 'BAD_DECISION'
      message: string
    }

export class ClaimService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly packs: PackRegistry,
  ) {}

  async assert(
    auth: AuthContext,
    entityId: string,
    controlKey: string,
    input: AssertClaimInput,
    now: Date = new Date(),
  ): Promise<AssertResult> {
    return this.uow(auth.tenantId, async (u) => {
      const found = await u.entities.get(entityId)
      if (!found) {
        return { ok: false, code: 'ENTITY_NOT_FOUND', message: `entity ${entityId} not found` }
      }

      const pack = this.packs.get(found.entity.packKey)
      const control = pack?.loaded?.controls.find((c) => c.key === controlKey)
      if (!control) {
        return {
          ok: false,
          code: 'UNKNOWN_CONTROL',
          message: `no control "${controlKey}" in this pack`,
        }
      }

      const applicability = found.evaluation.results.find((r) => r.control === controlKey)?.result
      if (
        applicability === 'NOT_APPLICABLE_TO_CLASSIFICATION' ||
        applicability === 'DUPLICATE_SOURCE_FIELD'
      ) {
        return {
          ok: false,
          code: 'CONTROL_NOT_APPLICABLE',
          message: `control "${controlKey}" does not apply to this entity`,
        }
      }

      const revision = (await u.claims.maxRevision(entityId, controlKey)) + 1
      const claim: ClaimRecord = {
        id: `clm_${randomUUID()}`,
        tenantId: auth.tenantId,
        entityId,
        controlKey,
        packKey: found.entity.packKey,
        origin: input.origin ?? 'INTERNAL_ASSERTION',
        revision,
        supersedesClaimId: null,
        status: 'PENDING_REVIEW',
        value: input.value,
        unit: input.unit ?? null,
        methodContext: input.methodContext ?? null,
        asOfDate: input.asOfDate ?? null,
        note: input.note ?? null,
        evidenceUrl: input.evidenceUrl ?? null,
        assertedBy: auth.actor,
        assertedAt: now.toISOString(),
      }

      await u.claims.insert(claim)
      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: 'claim.asserted',
        targetType: 'claim',
        targetId: claim.id,
        occurredAt: claim.assertedAt,
        metadata: { entityId, controlKey, origin: claim.origin, revision },
      })
      return { ok: true, claim }
    })
  }

  async decide(
    auth: AuthContext,
    claimId: string,
    input: DecideInput,
    now: Date = new Date(),
  ): Promise<DecideResult> {
    if (!REVIEW_DECISIONS.includes(input.decision)) {
      return {
        ok: false,
        code: 'BAD_DECISION',
        message: `unknown decision "${String(input.decision)}"`,
      }
    }
    if (
      (input.decision === 'REJECTED' || input.decision === 'CLARIFICATION_REQUESTED') &&
      !input.reason?.trim()
    ) {
      return {
        ok: false,
        code: 'REASON_REQUIRED',
        message: 'a reason is required to reject or request clarification',
      }
    }

    return this.uow(auth.tenantId, async (u) => {
      const claim = await u.claims.get(claimId)
      if (!claim)
        return { ok: false, code: 'CLAIM_NOT_FOUND', message: `claim ${claimId} not found` }
      if (claim.status !== 'PENDING_REVIEW' && claim.status !== 'ASSERTED') {
        return { ok: false, code: 'NOT_PENDING', message: `claim ${claimId} is ${claim.status}` }
      }

      const at = now.toISOString()

      if (input.decision === 'APPROVED') {
        const priorApproved = (await u.claims.listByEntity(claim.entityId)).filter(
          (c) => c.controlKey === claim.controlKey && c.status === 'APPROVED' && c.id !== claim.id,
        )
        for (const prev of priorApproved) {
          await u.claims.setStatus(prev.id, 'SUPERSEDED')
          await u.claims.recordDecision({
            id: `rvd_${randomUUID()}`,
            tenantId: auth.tenantId,
            claimId: prev.id,
            decision: 'SUPERSEDED',
            reason: `superseded by ${claim.id}`,
            reviewer: auth.actor,
            decidedAt: at,
          })
        }
        await u.claims.setStatus(claim.id, 'APPROVED', priorApproved[0]?.id ?? null)
      } else if (input.decision === 'REJECTED') {
        await u.claims.setStatus(claim.id, 'REJECTED')
      }
      // CLARIFICATION_REQUESTED leaves the claim PENDING_REVIEW.

      await u.claims.recordDecision({
        id: `rvd_${randomUUID()}`,
        tenantId: auth.tenantId,
        claimId: claim.id,
        decision: input.decision,
        reason: input.reason ?? null,
        reviewer: auth.actor,
        decidedAt: at,
      })
      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: 'claim.reviewed',
        targetType: 'claim',
        targetId: claim.id,
        occurredAt: at,
        reason: input.reason,
        metadata: {
          decision: input.decision,
          controlKey: claim.controlKey,
          entityId: claim.entityId,
        },
      })

      const updated = await u.claims.get(claim.id)
      return { ok: true, claim: updated ?? claim }
    })
  }

  async reviewQueue(
    auth: AuthContext,
    entityId: string,
  ): Promise<{ entityId: string; items: ClaimRecord[] } | null> {
    return this.uow(auth.tenantId, async (u) => {
      const found = await u.entities.get(entityId)
      if (!found) return null
      const claims = await u.claims.listByEntity(entityId)
      return {
        entityId,
        items: claims.filter((c) => c.status === 'PENDING_REVIEW' || c.status === 'ASSERTED'),
      }
    })
  }
}
