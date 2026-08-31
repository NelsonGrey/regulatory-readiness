import { describe, expect, it } from 'vitest'
import { diffControlSets, diffEvaluations, evaluationDiffIsEmpty } from './reevaluate.js'

const r = (control: string, result: string) => ({
  control,
  result: result as 'REQUIRED_BY_SNAPSHOT',
})

describe('diffEvaluations', () => {
  it('is empty for identical evaluations regardless of order', () => {
    const before = [r('A', 'REQUIRED_BY_SNAPSHOT'), r('B', 'NOT_APPLICABLE_TO_CLASSIFICATION')]
    const after = [r('B', 'NOT_APPLICABLE_TO_CLASSIFICATION'), r('A', 'REQUIRED_BY_SNAPSHOT')]
    const d = diffEvaluations(before, after)
    expect(evaluationDiffIsEmpty(d)).toBe(true)
    expect(d.unchanged).toBe(2)
  })

  it('reports added, removed, and applicability changes', () => {
    const before = [
      r('A', 'REQUIRED_BY_SNAPSHOT'),
      r('B', 'REQUIRED_BY_SNAPSHOT'),
      r('C', 'OPTIONAL_IF_AVAILABLE'),
    ]
    const after = [
      r('A', 'NOT_APPLICABLE_TO_CLASSIFICATION'), // changed
      r('C', 'OPTIONAL_IF_AVAILABLE'), // unchanged
      r('D', 'REQUIRED_BY_SNAPSHOT'), // added
      // B removed
    ]
    const d = diffEvaluations(before, after)
    expect(d.added).toEqual(['D'])
    expect(d.removed).toEqual(['B'])
    expect(d.applicabilityChanged).toEqual([
      { control: 'A', from: 'REQUIRED_BY_SNAPSHOT', to: 'NOT_APPLICABLE_TO_CLASSIFICATION' },
    ])
    expect(d.unchanged).toBe(1)
    expect(evaluationDiffIsEmpty(d)).toBe(false)
  })
})

describe('diffControlSets', () => {
  it('splits into added / removed / retained, sorted', () => {
    expect(diffControlSets(['C', 'A', 'B'], ['B', 'D', 'A'])).toEqual({
      added: ['D'],
      removed: ['C'],
      retained: ['A', 'B'],
    })
  })

  it('is empty added/removed when the sets match', () => {
    const d = diffControlSets(['A', 'B'], ['B', 'A'])
    expect(d.added).toEqual([])
    expect(d.removed).toEqual([])
    expect(d.retained).toEqual(['A', 'B'])
  })
})
