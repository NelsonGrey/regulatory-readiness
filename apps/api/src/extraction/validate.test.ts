import { describe, expect, it } from 'vitest'
import { hasBlockingError, validateProposal } from './validate.js'

describe('validateProposal', () => {
  it('flags an empty value as a blocking error', () => {
    const f = validateProposal({ value: '   ', unit: null })
    expect(f).toEqual([{ level: 'error', code: 'EMPTY', message: expect.any(String) }])
    expect(hasBlockingError(f)).toBe(true)
  })

  it('warns (does not block) on a malformed date / number / url', () => {
    expect(validateProposal({ value: 'March', unit: null, expectedType: 'date' })).toMatchObject([
      { level: 'warn', code: 'DATE_FORMAT' },
    ])
    const num = validateProposal({ value: '48', unit: null, expectedType: 'number' })
    expect(num).toMatchObject([{ level: 'warn', code: 'NO_UNIT' }])
    expect(hasBlockingError(num)).toBe(false)
    expect(
      validateProposal({ value: 'not a link', unit: null, expectedType: 'url' }),
    ).toMatchObject([{ level: 'warn', code: 'NOT_URL' }])
  })

  it('is clean for a plain non-empty value', () => {
    expect(validateProposal({ value: 'keyboard operable', unit: null })).toEqual([])
  })
})
