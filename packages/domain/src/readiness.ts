/**
 * Readiness vocabulary and the deterministic entity-status derivation.
 * See engine BRD §10 and engine TRD §13. Pure and replayable: same inputs → same output.
 */

export const READINESS_STATES = [
  'EVIDENCED',
  'SELF_ATTESTED',
  'MISSING',
  'CONFLICTING',
  'STALE',
  'PENDING_REVIEW',
  'CONDITIONAL',
  'NOT_YET_REQUIRED',
  'NOT_APPLICABLE',
] as const
export type ReadinessState = (typeof READINESS_STATES)[number]

/** States that count toward readiness for the selected snapshot. */
export const READY_STATES: readonly ReadinessState[] = ['EVIDENCED']

/** States excluded from the required set with a recorded reason. */
export const EXCLUDED_STATES: readonly ReadinessState[] = ['NOT_YET_REQUIRED', 'NOT_APPLICABLE']

/** States that block an evidence-ready verdict. */
export const BLOCKING_STATES: readonly ReadinessState[] = [
  'MISSING',
  'CONFLICTING',
  'STALE',
  'CONDITIONAL',
]

export const ENTITY_STATUSES = [
  'BLOCKED',
  'REVIEW_NEEDED',
  'EVIDENCE_READY',
  'OUTDATED_SNAPSHOT',
] as const
export type EntityStatus = (typeof ENTITY_STATUSES)[number]

export interface DeriveEntityStatusOptions {
  /** A newer control snapshot exists and impact review is not complete. */
  newerSnapshotPendingReview?: boolean
}

/**
 * Derive the overall entity status from the readiness state of every control the
 * selected snapshot requires (pass only required controls; excluded controls do
 * not affect the verdict).
 *
 * Precedence (engine BRD §10.2):
 *   1. BLOCKED         — any required control is MISSING | CONFLICTING | STALE | CONDITIONAL
 *   2. REVIEW_NEEDED   — no blocker, but any required control is PENDING_REVIEW or SELF_ATTESTED
 *   3. EVIDENCE_READY  — every required control is EVIDENCED (a document backs each approved claim)
 *   OUTDATED_SNAPSHOT overrides only a non-blocked result, so real blockers stay visible.
 */
export function deriveEntityStatus(
  requiredControlStates: readonly ReadinessState[],
  options: DeriveEntityStatusOptions = {},
): EntityStatus {
  const has = (s: ReadinessState): boolean => requiredControlStates.includes(s)

  if (BLOCKING_STATES.some(has)) return 'BLOCKED'
  if (options.newerSnapshotPendingReview) return 'OUTDATED_SNAPSHOT'
  if (has('PENDING_REVIEW') || has('SELF_ATTESTED')) return 'REVIEW_NEEDED'
  if (requiredControlStates.every((s) => s === 'EVIDENCED')) return 'EVIDENCE_READY'

  // Any remaining combination (e.g. a stray NOT_APPLICABLE passed in) is not ready.
  return 'REVIEW_NEEDED'
}
