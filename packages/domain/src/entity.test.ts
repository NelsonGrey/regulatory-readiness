import { describe, expect, it } from 'vitest'
import { summariseApplicability } from './entity.js'
import type { ControlApplicabilityRecord } from './entity.js'

const results: ControlApplicabilityRecord[] = [
  { control: 'A', result: 'REQUIRED_BY_SNAPSHOT' },
  { control: 'B', result: 'REQUIRED_BY_SNAPSHOT' },
  { control: 'C', result: 'OPTIONAL_IF_AVAILABLE' },
  { control: 'D', result: 'NOT_APPLICABLE_TO_CLASSIFICATION' },
  { control: 'E', result: 'CONDITIONAL_FACT_REQUIRED' },
]

describe('summariseApplicability', () => {
  it('counts by result', () => {
    expect(summariseApplicability(results)).toEqual({
      total: 5,
      requiredNow: 2,
      optional: 1,
      conditional: 1,
      notApplicable: 1,
      notYetRequired: 0,
      needsSpecialistReview: 0,
      duplicate: 0,
    })
  })

  it('handles an empty list', () => {
    expect(summariseApplicability([]).total).toBe(0)
  })
})
