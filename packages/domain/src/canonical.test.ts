import { describe, expect, it } from 'vitest'
import { canonicalJson } from './canonical.js'

describe('canonicalJson', () => {
  it('is independent of key order', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }))
  })

  it('recurses into nested objects and arrays', () => {
    const a = canonicalJson({ x: [{ q: 1, p: 2 }], y: { n: 3, m: 4 } })
    const b = canonicalJson({ y: { m: 4, n: 3 }, x: [{ p: 2, q: 1 }] })
    expect(a).toBe(b)
  })

  it('preserves array order', () => {
    expect(canonicalJson([1, 2, 3])).not.toBe(canonicalJson([3, 2, 1]))
  })
})
