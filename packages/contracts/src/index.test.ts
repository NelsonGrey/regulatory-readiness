import { describe, expect, it } from 'vitest'
import { ApplicabilityRuleSet, ControlsFile, PackManifest } from './index.js'

const validManifest = {
  packKey: 'eaa-accessibility',
  title: 'EU Accessibility Act (Directive 2019/882) — Ireland',
  sourceAuthority: 'European Union / European Commission',
  jurisdiction: 'IE',
  sourceUrls: ['https://eur-lex.europa.eu/eli/dir/2019/882/oj'],
  publicationDate: '2019-04-17',
  retrievedDate: 'TBD' as const,
  sourceChecksum: 'sha256:placeholder',
  catalogVersion: '0.1.0',
  snapshotKey: 'EAA-IE-EN549-V3.2.1-DRAFT',
  status: 'draft' as const,
}

describe('PackManifest', () => {
  it('accepts a well-formed manifest and applies defaults', () => {
    const parsed = PackManifest.parse(validManifest)
    expect(parsed.packKey).toBe('eaa-accessibility')
    expect(parsed.effectiveDates).toEqual([])
    expect(parsed.supersedes).toBeNull()
    expect(parsed.review.reviewers).toEqual([])
  })

  it('rejects a non-kebab-case pack key', () => {
    expect(() => PackManifest.parse({ ...validManifest, packKey: 'EAA_Accessibility' })).toThrow()
  })

  it('requires at least one source URL', () => {
    expect(() => PackManifest.parse({ ...validManifest, sourceUrls: [] })).toThrow()
  })
})

describe('ControlsFile', () => {
  it('applies control defaults', () => {
    const parsed = ControlsFile.parse({
      packKey: 'eaa-accessibility',
      controls: [
        {
          key: 'EAA-EN549-9-1-1-1',
          title: 'Non-text content has a text alternative',
          family: 'web',
          fieldFamily: 'web-sc-check',
          evidenceExpectation: 'Manual audit record plus automated scan output.',
        },
      ],
    })
    expect(parsed.controls[0]?.accessClassDefault).toBe('PUBLIC_CANDIDATE')
    expect(parsed.controls[0]?.wcagVersionMin).toBe('2.1')
    expect(parsed.controls[0]?.standardClause).toBeNull()
  })

  it('rejects a lowercase control key', () => {
    expect(() =>
      ControlsFile.parse({
        packKey: 'x',
        controls: [
          {
            key: 'eaa-lower',
            title: 't',
            family: 'web',
            fieldFamily: 'web-sc-check',
            evidenceExpectation: 'e',
          },
        ],
      }),
    ).toThrow()
  })
})

describe('ApplicabilityRuleSet', () => {
  it('parses a nested expression', () => {
    const parsed = ApplicabilityRuleSet.parse({
      packKey: 'eaa-accessibility',
      defaultResult: 'REQUIRED_BY_SNAPSHOT',
      rules: [
        {
          id: 'web-family-off',
          when: { not: { fact: 'hasWebsite', eq: true } },
          target: { family: 'web' },
          result: 'NOT_APPLICABLE_TO_CLASSIFICATION',
          reason: 'no website in scope',
        },
      ],
    })
    expect(parsed.rules).toHaveLength(1)
  })
})
