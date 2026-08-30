import { describe, expect, it } from 'vitest'
import { deriveEntityStatus } from './readiness.js'

describe('deriveEntityStatus', () => {
  it('is EVIDENCE_READY when every required control is EVIDENCED', () => {
    expect(deriveEntityStatus(['EVIDENCED', 'EVIDENCED'])).toBe('EVIDENCE_READY')
  })

  it('is BLOCKED when any required control is MISSING/CONFLICTING/STALE/CONDITIONAL', () => {
    expect(deriveEntityStatus(['EVIDENCED', 'MISSING'])).toBe('BLOCKED')
    expect(deriveEntityStatus(['EVIDENCED', 'CONFLICTING'])).toBe('BLOCKED')
    expect(deriveEntityStatus(['EVIDENCED', 'STALE'])).toBe('BLOCKED')
    expect(deriveEntityStatus(['EVIDENCED', 'CONDITIONAL'])).toBe('BLOCKED')
  })

  it('is REVIEW_NEEDED when the only non-evidenced control is PENDING_REVIEW', () => {
    expect(deriveEntityStatus(['EVIDENCED', 'PENDING_REVIEW'])).toBe('REVIEW_NEEDED')
  })

  it('lets a blocker win over an outdated snapshot so the blocker stays visible', () => {
    expect(deriveEntityStatus(['MISSING'], { newerSnapshotPendingReview: true })).toBe('BLOCKED')
  })

  it('reports OUTDATED_SNAPSHOT when not blocked and impact review is pending', () => {
    expect(deriveEntityStatus(['EVIDENCED'], { newerSnapshotPendingReview: true })).toBe(
      'OUTDATED_SNAPSHOT',
    )
  })
})
