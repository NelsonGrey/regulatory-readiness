/**
 * Primitive schemas and enums shared across the engine.
 * Zod is the single source of truth; types are inferred.
 */
import { z } from 'zod'

export { z }

/** ISO-8601 date (YYYY-MM-DD). */
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')

/** Data access classifications — engine TRD §15.2. */
export const AccessClass = z.enum([
  'PUBLIC_CANDIDATE',
  'LEGITIMATE_INTEREST_RESTRICTED',
  'AUTHORITY_RESTRICTED',
  'INTERNAL_CONFIDENTIAL',
  'PARTY_CONFIDENTIAL',
])
export type AccessClass = z.infer<typeof AccessClass>

/** Applicability results the evaluator may return — engine TRD §7.2. */
export const ApplicabilityResult = z.enum([
  'REQUIRED_BY_SNAPSHOT',
  'OPTIONAL_IF_AVAILABLE',
  'CONDITIONAL_FACT_REQUIRED',
  'NOT_YET_REQUIRED_BY_SNAPSHOT',
  'DUPLICATE_SOURCE_FIELD',
  'NOT_APPLICABLE_TO_CLASSIFICATION',
  'NEEDS_SPECIALIST_REVIEW',
])
export type ApplicabilityResult = z.infer<typeof ApplicabilityResult>

/** Readiness states per control — engine BRD §10.1. */
export const ReadinessState = z.enum([
  'EVIDENCED',
  'MISSING',
  'CONFLICTING',
  'STALE',
  'PENDING_REVIEW',
  'CONDITIONAL',
  'NOT_YET_REQUIRED',
  'NOT_APPLICABLE',
])
export type ReadinessState = z.infer<typeof ReadinessState>
