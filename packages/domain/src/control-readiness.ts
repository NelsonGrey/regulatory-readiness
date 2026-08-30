/**
 * Deterministic per-control readiness and the roll-up to entity status
 * (engine TRD §13.2, BRD §10). Pure and replayable.
 */
import type { ApplicabilityResult } from '@rre/contracts'
import { deriveEntityStatus, type EntityStatus, type ReadinessState } from './readiness.js'

export const CLAIM_STATUSES = [
  'ASSERTED',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUPERSEDED',
  'WITHDRAWN',
] as const
export type ClaimStatus = (typeof CLAIM_STATUSES)[number]

export const CLAIM_ORIGINS = [
  'SUPPLIER_ASSERTION',
  'INTERNAL_ASSERTION',
  'EXTRACTION_ACCEPTED',
  'IMPORTED_APPROVED_DATA',
] as const
export type ClaimOrigin = (typeof CLAIM_ORIGINS)[number]

export const REVIEW_DECISIONS = [
  'APPROVED',
  'REJECTED',
  'CLARIFICATION_REQUESTED',
  'SUPERSEDED',
] as const
export type ReviewDecisionKind = (typeof REVIEW_DECISIONS)[number]

export interface ControlReadinessInput {
  applicability: ApplicabilityResult
  /** Count of `APPROVED` claims for this control. */
  approvedClaims: number
  /** Count of `PENDING_REVIEW` / `ASSERTED` claims for this control. */
  pendingClaims: number
  /** An approved claim's evidence or as-of window has expired. */
  approvedStale?: boolean
  /** An unresolved conflict has been recorded for this control. */
  conflictOpen?: boolean
}

/**
 * One control's readiness state. Precedence: excluded-by-applicability →
 * conflicting → stale/evidenced (approved present) → pending → missing.
 */
export function deriveControlReadiness(i: ControlReadinessInput): ReadinessState {
  switch (i.applicability) {
    case 'NOT_APPLICABLE_TO_CLASSIFICATION':
    case 'DUPLICATE_SOURCE_FIELD':
      return 'NOT_APPLICABLE'
    case 'NOT_YET_REQUIRED_BY_SNAPSHOT':
      return 'NOT_YET_REQUIRED'
    case 'CONDITIONAL_FACT_REQUIRED':
    case 'NEEDS_SPECIALIST_REVIEW':
      return 'CONDITIONAL'
    case 'REQUIRED_BY_SNAPSHOT':
    case 'OPTIONAL_IF_AVAILABLE':
      break
  }

  if (i.conflictOpen || i.approvedClaims > 1) return 'CONFLICTING'
  if (i.approvedClaims === 1) return i.approvedStale ? 'STALE' : 'EVIDENCED'
  if (i.pendingClaims > 0) return 'PENDING_REVIEW'
  return 'MISSING'
}

export interface ControlReadiness {
  control: string
  applicability: ApplicabilityResult
  readiness: ReadinessState
}

export type ReadinessCounts = Record<ReadinessState, number>

export interface EntityReadiness {
  perControl: ControlReadiness[]
  counts: ReadinessCounts
  entityStatus: EntityStatus
}

export interface ControlClaimState {
  approved: number
  pending: number
  stale?: boolean
  conflict?: boolean
}

const ZERO_COUNTS = (): ReadinessCounts => ({
  EVIDENCED: 0,
  MISSING: 0,
  CONFLICTING: 0,
  STALE: 0,
  PENDING_REVIEW: 0,
  CONDITIONAL: 0,
  NOT_YET_REQUIRED: 0,
  NOT_APPLICABLE: 0,
})

/**
 * Readiness for every control on an entity plus the deterministic entity status.
 * Only `REQUIRED_BY_SNAPSHOT` controls count toward the entity status
 * (optional/excluded controls can be `MISSING` without blocking).
 */
export function readinessForEntity(
  controls: ReadonlyArray<{ control: string; applicability: ApplicabilityResult }>,
  claimStateByControl: ReadonlyMap<string, ControlClaimState>,
  options: { newerSnapshotPendingReview?: boolean } = {},
): EntityReadiness {
  const perControl: ControlReadiness[] = controls.map((c) => {
    const cs = claimStateByControl.get(c.control)
    return {
      control: c.control,
      applicability: c.applicability,
      readiness: deriveControlReadiness({
        applicability: c.applicability,
        approvedClaims: cs?.approved ?? 0,
        pendingClaims: cs?.pending ?? 0,
        approvedStale: cs?.stale,
        conflictOpen: cs?.conflict,
      }),
    }
  })

  const counts = ZERO_COUNTS()
  for (const c of perControl) counts[c.readiness]++

  const requiredStates = perControl
    .filter((c) => c.applicability === 'REQUIRED_BY_SNAPSHOT')
    .map((c) => c.readiness)

  return { perControl, counts, entityStatus: deriveEntityStatus(requiredStates, options) }
}
