import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { ApplicabilityRuleSet } from '@rre/contracts'
import { evaluateApplicability, evaluateExpression, loadPack } from './index.js'

const facts = {
  entityKind: 'service',
  isMicroEnterprise: false,
  hasWebsite: true,
}

describe('evaluateExpression', () => {
  const opts = { snapshotKey: 'SNAP-1' }

  it('handles always / snapshot / known', () => {
    expect(evaluateExpression({ always: true }, {}, opts)).toBe(true)
    expect(evaluateExpression({ snapshot: 'SNAP-1' }, {}, opts)).toBe(true)
    expect(evaluateExpression({ snapshot: 'OTHER' }, {}, opts)).toBe(false)
    expect(evaluateExpression({ known: 'hasWebsite' }, facts, opts)).toBe(true)
    expect(evaluateExpression({ known: 'missing' }, facts, opts)).toBe(false)
  })

  it('handles fact predicates and returns unknown for absent facts', () => {
    expect(evaluateExpression({ fact: 'hasWebsite', eq: true }, facts, opts)).toBe(true)
    expect(
      evaluateExpression({ fact: 'entityKind', in: ['product', 'service'] }, facts, opts),
    ).toBe(true)
    expect(evaluateExpression({ fact: 'absent', eq: true }, facts, opts)).toBe('unknown')
  })

  it('propagates unknown through all / any / not', () => {
    expect(
      evaluateExpression(
        {
          all: [
            { fact: 'hasWebsite', eq: true },
            { fact: 'x', eq: true },
          ],
        },
        facts,
        opts,
      ),
    ).toBe('unknown')
    expect(
      evaluateExpression(
        {
          any: [
            { fact: 'hasWebsite', eq: true },
            { fact: 'x', eq: true },
          ],
        },
        facts,
        opts,
      ),
    ).toBe(true)
    expect(evaluateExpression({ not: { fact: 'x', eq: true } }, facts, opts)).toBe('unknown')
    expect(evaluateExpression({ not: { fact: 'hasWebsite', eq: true } }, facts, opts)).toBe(false)
  })
})

describe('evaluateApplicability', () => {
  const ruleSet: ApplicabilityRuleSet = {
    packKey: 'demo',
    defaultResult: 'REQUIRED_BY_SNAPSHOT',
    rules: [
      {
        id: 'web-off',
        when: { not: { fact: 'hasWebsite', eq: true } },
        target: { family: 'web' },
        result: 'NOT_APPLICABLE_TO_CLASSIFICATION',
      },
    ],
  }
  const controls = [
    { key: 'C-WEB', family: 'web' },
    { key: 'C-DOC', family: 'documents' },
  ]

  it('applies the default when no rule matches', () => {
    const r = evaluateApplicability(ruleSet, controls, { hasWebsite: true }, { snapshotKey: 's' })
    expect(r).toEqual([
      { control: 'C-WEB', result: 'REQUIRED_BY_SNAPSHOT' },
      { control: 'C-DOC', result: 'REQUIRED_BY_SNAPSHOT' },
    ])
  })

  it('applies a matching rule to its target family only', () => {
    const r = evaluateApplicability(ruleSet, controls, { hasWebsite: false }, { snapshotKey: 's' })
    expect(r[0]).toMatchObject({ control: 'C-WEB', result: 'NOT_APPLICABLE_TO_CLASSIFICATION' })
    expect(r[1]).toMatchObject({ control: 'C-DOC', result: 'REQUIRED_BY_SNAPSHOT' })
  })

  it('returns CONDITIONAL_FACT_REQUIRED when a matching rule depends on an absent fact', () => {
    const r = evaluateApplicability(ruleSet, controls, {}, { snapshotKey: 's' })
    expect(r[0]).toMatchObject({ control: 'C-WEB', result: 'CONDITIONAL_FACT_REQUIRED' })
  })
})

describe('eaa-accessibility pack vectors', () => {
  it('every declared vector produces the expected results', async () => {
    const pack = await loadPack(
      fileURLToPath(new URL('../../../packs/eaa-accessibility', import.meta.url)),
    )
    const index = pack.controls.map((c) => ({ key: c.key, family: c.family }))
    for (const vector of pack.testVectors.applicability) {
      const results = evaluateApplicability(pack.applicability, index, vector.facts, {
        snapshotKey: vector.snapshotKey,
      })
      const byKey = new Map(results.map((r) => [r.control, r.result]))
      for (const expected of vector.expect) {
        expect(byKey.get(expected.control), `${vector.name} :: ${expected.control}`).toBe(
          expected.result,
        )
      }
    }
  })
})
