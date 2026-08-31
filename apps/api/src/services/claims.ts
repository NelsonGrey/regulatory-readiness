import { createHash, randomUUID } from 'node:crypto'
import {
  canonicalJson,
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

export type SupportType = 'SUPPORTS' | 'CONTEXT' | 'CONTRADICTS'

export interface EvidenceLocationRecord {
  id: string
  tenantId: string
  documentId: string
  page: number | null
  sheet: string | null
  cell: string | null
  bbox: unknown
  quote: string | null
  locationHash: string
  createdBy: string
  createdAt: string
}

export interface ClaimEvidenceLinkRecord {
  id: string
  tenantId: string
  claimId: string
  evidenceLocationId: string
  supportType: SupportType
  addedBy: string
  createdAt: string
}

/** One evidence link joined to its location + document, for display. */
export interface EvidenceView {
  linkId: string
  claimId: string
  supportType: SupportType
  documentId: string
  documentFilename: string | null
  documentHash: string | null
  page: number | null
  sheet: string | null
  cell: string | null
  quote: string | null
  addedBy: string
  createdAt: string
}

/** Transaction-scoped persistence port for claims + review decisions + evidence links. */
export interface ClaimRepository {
  insert(claim: ClaimRecord): Promise<void>
  get(id: string): Promise<ClaimRecord | null>
  listByEntity(entityId: string): Promise<ClaimRecord[]>
  setStatus(id: string, status: ClaimStatus, supersedesClaimId?: string | null): Promise<void>
  recordDecision(decision: ReviewDecisionRecord): Promise<void>
  maxRevision(entityId: string, controlKey: string): Promise<number>

  linkEvidence(location: EvidenceLocationRecord, link: ClaimEvidenceLinkRecord): Promise<void>
  listEvidenceByClaim(claimId: string): Promise<EvidenceView[]>
  listEvidenceByEntity(entityId: string): Promise<EvidenceView[]>
}

/**
 * Roll up a claim list into per-control approved/pending counts (engine TRD §13).
 * Pass `evidencedClaimIds` — the ids of approved claims that have at least one
 * `SUPPORTS` evidence link — so a claim without a document reads as
 * `SELF_ATTESTED`, not `EVIDENCED`.
 */
export function claimStateByControl(
  claims: readonly ClaimRecord[],
  evidencedClaimIds: ReadonlySet<string> = new Set(),
): Map<string, ControlClaimState> {
  const map = new Map<string, ControlClaimState>()
  for (const c of claims) {
    const s = map.get(c.controlKey) ?? { approved: 0, pending: 0 }
    if (c.status === 'APPROVED') {
      s.approved++
      if (evidencedClaimIds.has(c.id)) s.evidenced = true
    }
    if (c.status === 'PENDING_REVIEW' || c.status === 'ASSERTED') s.pending++
    map.set(c.controlKey, s)
  }
  return map
}

/** The ids of claims that have at least one `SUPPORTS` evidence link. */
export function evidencedClaimIds(evidence: readonly EvidenceView[]): Set<string> {
  const ids = new Set<string>()
  for (const e of evidence) if (e.supportType === 'SUPPORTS') ids.add(e.claimId)
  return ids
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

export interface LinkEvidenceInput {
  documentId: string
  page?: number
  sheet?: string
  cell?: string
  quote?: string
  supportType?: SupportType
}

export type LinkEvidenceResult =
  | { ok: true; evidenceLocationId: string; linkId: string }
  | {
      ok: false
      code: 'CLAIM_NOT_FOUND' | 'DOCUMENT_NOT_FOUND' | 'DOCUMENT_NOT_AVAILABLE'
      message: string
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

  async linkEvidence(
    auth: AuthContext,
    claimId: string,
    input: LinkEvidenceInput,
    now: Date = new Date(),
  ): Promise<LinkEvidenceResult> {
    return this.uow(auth.tenantId, async (u) => {
      const claim = await u.claims.get(claimId)
      if (!claim) {
        return { ok: false, code: 'CLAIM_NOT_FOUND', message: `claim ${claimId} not found` }
      }
      const doc = await u.documents.get(input.documentId)
      if (!doc) {
        return { ok: false, code: 'DOCUMENT_NOT_FOUND', message: 'document not found' }
      }
      if (doc.status !== 'AVAILABLE') {
        return {
          ok: false,
          code: 'DOCUMENT_NOT_AVAILABLE',
          message: `document is ${doc.status}, not AVAILABLE`,
        }
      }

      const at = now.toISOString()
      const loc = {
        documentId: input.documentId,
        page: input.page ?? null,
        sheet: input.sheet ?? null,
        cell: input.cell ?? null,
        quote: input.quote ?? null,
      }
      const location: EvidenceLocationRecord = {
        id: `evl_${randomUUID()}`,
        tenantId: auth.tenantId,
        ...loc,
        bbox: null,
        locationHash: `sha256:${createHash('sha256')
          .update(canonicalJson({ ...loc, hash: doc.contentHash }))
          .digest('hex')}`,
        createdBy: auth.actor,
        createdAt: at,
      }
      const link: ClaimEvidenceLinkRecord = {
        id: `cel_${randomUUID()}`,
        tenantId: auth.tenantId,
        claimId,
        evidenceLocationId: location.id,
        supportType: input.supportType ?? 'SUPPORTS',
        addedBy: auth.actor,
        createdAt: at,
      }
      await u.claims.linkEvidence(location, link)
      await u.audit({
        actorType: 'user',
        actorId: auth.actor,
        action: 'claim.evidence_linked',
        targetType: 'claim',
        targetId: claimId,
        occurredAt: at,
        metadata: {
          documentId: input.documentId,
          supportType: link.supportType,
          controlKey: claim.controlKey,
          entityId: claim.entityId,
        },
      })
      return { ok: true, evidenceLocationId: location.id, linkId: link.id }
    })
  }

  async listEvidence(auth: AuthContext, claimId: string): Promise<EvidenceView[]> {
    return this.uow(auth.tenantId, (u) => u.claims.listEvidenceByClaim(claimId))
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
