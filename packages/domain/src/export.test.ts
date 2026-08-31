import { describe, expect, it } from 'vitest'
import {
  buildCanonicalExport,
  canonicalExportToCsv,
  canonicalExportVerdict,
  type BuildCanonicalExportInput,
  type ExportControlInput,
} from './export.js'
import { canonicalJson } from './canonical.js'

const control = (over: Partial<ExportControlInput>): ExportControlInput => ({
  key: 'C-1',
  title: 'Text alternatives',
  family: 'perceivable',
  standardClause: '9.1.1.1',
  wcagSc: '1.1.1',
  accessClass: 'PUBLIC_CANDIDATE',
  applicability: 'REQUIRED_BY_SNAPSHOT',
  applicabilityReason: null,
  readiness: 'EVIDENCED',
  approvedClaim: null,
  ...over,
})

const base = (controls: ExportControlInput[]): BuildCanonicalExportInput => ({
  generatedAt: '2026-08-31T12:00:00.000Z',
  entity: {
    id: 'ent_1',
    name: 'Acme Store',
    identifier: 'acme',
    kind: 'service',
    packKey: 'eaa-accessibility',
  },
  responsibleOrganization: null,
  facts: { offeredToConsumersInIE: true, entityKind: 'service' },
  snapshotKey: 'EAA-EN549-2025-06',
  packSource: {
    authority: 'European Union',
    catalogVersion: '1',
    publicationDate: '2019-04-17',
    retrievedDate: '2026-08-01',
    sourceChecksum: 'sha256:abc',
    sourceUrls: ['https://eur-lex.europa.eu/eli/dir/2019/882/oj'],
  },
  evaluation: { id: 'eval_1', hash: 'sha256:deadbeef', evaluatedAt: '2026-08-30T00:00:00.000Z' },
  entityStatus: 'REVIEW_NEEDED',
  readinessCounts: {
    EVIDENCED: 1,
    MISSING: 1,
    PENDING_REVIEW: 0,
    CONFLICTING: 0,
    STALE: 0,
    CONDITIONAL: 0,
    NOT_YET_REQUIRED: 0,
    NOT_APPLICABLE: 0,
  },
  controls,
})

describe('buildCanonicalExport', () => {
  it('sorts controls by key and is byte-stable for the same inputs', () => {
    const a = buildCanonicalExport(base([control({ key: 'C-2' }), control({ key: 'C-1' })]))
    const b = buildCanonicalExport(base([control({ key: 'C-1' }), control({ key: 'C-2' })]))
    expect(a.controls.map((c) => c.key)).toEqual(['C-1', 'C-2'])
    expect(canonicalJson(a)).toEqual(canonicalJson(b))
  })

  it('lists an exception for every required control that is not evidenced', () => {
    const doc = buildCanonicalExport(
      base([
        control({ key: 'C-1', readiness: 'EVIDENCED' }),
        control({ key: 'C-2', readiness: 'MISSING' }),
        control({ key: 'C-3', readiness: 'PENDING_REVIEW' }),
        // optional + missing → not an exception
        control({ key: 'C-4', applicability: 'OPTIONAL_IF_AVAILABLE', readiness: 'MISSING' }),
        // excluded → not an exception
        control({
          key: 'C-5',
          applicability: 'NOT_APPLICABLE_TO_CLASSIFICATION',
          readiness: 'NOT_APPLICABLE',
        }),
      ]),
    )
    expect(doc.exceptions.map((e) => e.control)).toEqual(['C-2', 'C-3'])
    expect(doc.exceptions[0]?.note).toMatch(/no approved evidence/i)
  })

  it('carries the approved claim through to the control and CSV', () => {
    const doc = buildCanonicalExport(
      base([
        control({
          key: 'C-1',
          approvedClaim: {
            value: 'alt text on all images',
            unit: null,
            method: 'manual audit',
            origin: 'INTERNAL_ASSERTION',
            asOfDate: '2026-08-20',
            assertedAt: '2026-08-20T09:00:00.000Z',
          },
        }),
      ]),
    )
    expect(doc.controls[0]?.approvedClaim?.value).toBe('alt text on all images')
    const csv = canonicalExportToCsv(doc)
    expect(csv.split('\r\n')[0]).toContain('approved_value')
    expect(csv).toContain('alt text on all images')
    expect(csv).toContain('INTERNAL_ASSERTION')
  })
})

describe('canonicalExportVerdict', () => {
  it('never uses a forbidden phrase and maps each entity status', () => {
    const forbidden = /\b(compliant|certified|guaranteed)\b/i
    for (const status of [
      'EVIDENCE_READY',
      'REVIEW_NEEDED',
      'BLOCKED',
      'OUTDATED_SNAPSHOT',
    ] as const) {
      const v = canonicalExportVerdict(status, 'SNAP-1')
      expect(v.statement).not.toMatch(forbidden)
      expect(v.statement).toContain('SNAP-1')
    }
    expect(canonicalExportVerdict('EVIDENCE_READY', 'SNAP-1').code).toBe(
      'EVIDENCE_READY_FOR_SNAPSHOT',
    )
    expect(canonicalExportVerdict('BLOCKED', 'SNAP-1').code).toBe('NOT_YET_MET')
  })
})
