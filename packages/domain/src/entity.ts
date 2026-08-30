/**
 * Regulated-entity domain types and the immutable scope-evaluation record.
 * A scope evaluation is the per-control applicability result for one entity
 * against one control snapshot, plus a reproducibility hash (engine AC-003).
 *
 * Browser-safe: no Node built-ins. The hash itself is computed by the caller
 * (Node crypto) over `canonicalJson({ packKey, snapshotKey, facts, results })`.
 */
import type { ApplicabilityResult, FactValue } from '@rre/contracts'

export const ENTITY_KINDS = ['product', 'service'] as const
export type EntityKind = (typeof ENTITY_KINDS)[number]

export interface RegulatedEntity {
  id: string
  tenantId: string
  packKey: string
  name: string
  entityIdentifier: string
  entityKind: EntityKind
  createdAt: string
  createdBy: string
  currentEvaluationId: string
}

export type EntityFacts = Record<string, FactValue>

export interface ControlApplicabilityRecord {
  control: string
  result: ApplicabilityResult
  reason?: string
  ruleId?: string
}

export interface EntityScopeEvaluation {
  id: string
  entityId: string
  tenantId: string
  packKey: string
  snapshotKey: string
  /** Monotonic per entity; a scope-fact change creates a new version. */
  version: number
  facts: EntityFacts
  results: ControlApplicabilityRecord[]
  evaluatedAt: string
  evaluatedBy: string
  /** `sha256:<hex>` over the canonical form of the evaluation inputs + outputs. */
  hash: string
}

/** Inputs + outputs that make a scope evaluation reproducible; caller hashes `canonicalJson` of this. */
export interface EvaluationDigestInput {
  packKey: string
  snapshotKey: string
  facts: EntityFacts
  results: ControlApplicabilityRecord[]
}

export interface ApplicabilitySummary {
  total: number
  requiredNow: number
  optional: number
  conditional: number
  notApplicable: number
  notYetRequired: number
  needsSpecialistReview: number
  duplicate: number
}

/** Count controls by applicability result — the honest denominator for a matrix (engine BR-014). */
export function summariseApplicability(
  results: readonly ControlApplicabilityRecord[],
): ApplicabilitySummary {
  const summary: ApplicabilitySummary = {
    total: results.length,
    requiredNow: 0,
    optional: 0,
    conditional: 0,
    notApplicable: 0,
    notYetRequired: 0,
    needsSpecialistReview: 0,
    duplicate: 0,
  }
  for (const r of results) {
    switch (r.result) {
      case 'REQUIRED_BY_SNAPSHOT':
        summary.requiredNow++
        break
      case 'OPTIONAL_IF_AVAILABLE':
        summary.optional++
        break
      case 'CONDITIONAL_FACT_REQUIRED':
        summary.conditional++
        break
      case 'NOT_APPLICABLE_TO_CLASSIFICATION':
        summary.notApplicable++
        break
      case 'NOT_YET_REQUIRED_BY_SNAPSHOT':
        summary.notYetRequired++
        break
      case 'NEEDS_SPECIALIST_REVIEW':
        summary.needsSpecialistReview++
        break
      case 'DUPLICATE_SOURCE_FIELD':
        summary.duplicate++
        break
    }
  }
  return summary
}
