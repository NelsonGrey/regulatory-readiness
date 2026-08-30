import { describe, expect, it } from 'vitest'
import {
  deriveControlReadiness,
  readinessForEntity,
  type ControlClaimState,
} from './control-readiness.js'

describe('deriveControlReadiness', () => {
  const base = { approvedClaims: 0, pendingClaims: 0 }

  it('maps excluded applicability results to neutral readiness states', () => {
    expect(
      deriveControlReadiness({ ...base, applicability: 'NOT_APPLICABLE_TO_CLASSIFICATION' }),
    ).toBe('NOT_APPLICABLE')
    expect(deriveControlReadiness({ ...base, applicability: 'DUPLICATE_SOURCE_FIELD' })).toBe(
      'NOT_APPLICABLE',
    )
    expect(deriveControlReadiness({ ...base, applicability: 'NOT_YET_REQUIRED_BY_SNAPSHOT' })).toBe(
      'NOT_YET_REQUIRED',
    )
    expect(deriveControlReadiness({ ...base, applicability: 'CONDITIONAL_FACT_REQUIRED' })).toBe(
      'CONDITIONAL',
    )
    expect(deriveControlReadiness({ ...base, applicability: 'NEEDS_SPECIALIST_REVIEW' })).toBe(
      'CONDITIONAL',
    )
  })

  it('walks the precedence for an applicable control', () => {
    const req = { applicability: 'REQUIRED_BY_SNAPSHOT' as const }
    expect(deriveControlReadiness({ ...req, approvedClaims: 0, pendingClaims: 0 })).toBe('MISSING')
    expect(deriveControlReadiness({ ...req, approvedClaims: 0, pendingClaims: 2 })).toBe(
      'PENDING_REVIEW',
    )
    expect(deriveControlReadiness({ ...req, approvedClaims: 1, pendingClaims: 1 })).toBe(
      'EVIDENCED',
    )
    expect(
      deriveControlReadiness({ ...req, approvedClaims: 1, pendingClaims: 0, approvedStale: true }),
    ).toBe('STALE')
    expect(deriveControlReadiness({ ...req, approvedClaims: 2, pendingClaims: 0 })).toBe(
      'CONFLICTING',
    )
    expect(
      deriveControlReadiness({ ...req, approvedClaims: 1, pendingClaims: 0, conflictOpen: true }),
    ).toBe('CONFLICTING')
  })
})

describe('readinessForEntity', () => {
  const controls = [
    { control: 'R1', applicability: 'REQUIRED_BY_SNAPSHOT' as const },
    { control: 'R2', applicability: 'REQUIRED_BY_SNAPSHOT' as const },
    { control: 'O1', applicability: 'OPTIONAL_IF_AVAILABLE' as const },
    { control: 'N1', applicability: 'NOT_APPLICABLE_TO_CLASSIFICATION' as const },
  ]

  const claims = (m: Record<string, ControlClaimState>) => new Map(Object.entries(m))

  it('is BLOCKED while a required control is missing; optional gaps do not block', () => {
    const r = readinessForEntity(controls, claims({ R1: { approved: 1, pending: 0 } }))
    expect(r.entityStatus).toBe('BLOCKED') // R2 missing
    expect(r.counts.EVIDENCED).toBe(1)
    expect(r.counts.MISSING).toBe(2) // R2 + O1
    expect(r.counts.NOT_APPLICABLE).toBe(1)
  })

  it('is REVIEW_NEEDED when required controls are evidenced or pending only', () => {
    const r = readinessForEntity(
      controls,
      claims({ R1: { approved: 1, pending: 0 }, R2: { approved: 0, pending: 1 } }),
    )
    expect(r.entityStatus).toBe('REVIEW_NEEDED')
  })

  it('is EVIDENCE_READY when every required control is evidenced', () => {
    const r = readinessForEntity(
      controls,
      claims({ R1: { approved: 1, pending: 0 }, R2: { approved: 1, pending: 0 } }),
    )
    expect(r.entityStatus).toBe('EVIDENCE_READY')
  })

  it('a required conflict blocks even when the rest are evidenced', () => {
    const r = readinessForEntity(
      controls,
      claims({ R1: { approved: 1, pending: 0 }, R2: { approved: 2, pending: 0 } }),
    )
    expect(r.entityStatus).toBe('BLOCKED')
    expect(r.counts.CONFLICTING).toBe(1)
  })
})
