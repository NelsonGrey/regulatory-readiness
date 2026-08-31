/**
 * Canonical readiness export (engine TRD §14.1). Pure and deterministic: the
 * same frozen inputs always produce byte-identical `canonicalJson` output, so it
 * can be content-addressed. No `node:crypto` here — the API hashes the result.
 *
 * The verdict language is deliberately narrow: this document never says
 * "compliant" or "certified". It reports what is *evidenced* against a named
 * control snapshot and lists what is not.
 */
import type { ApplicabilityResult } from '@rre/contracts'
import type { EntityStatus, ReadinessState } from './readiness.js'

export const EXPORT_SCHEMA_VERSION = '1.0'

export interface ExportApprovedClaim {
  value: string
  unit: string | null
  method: string | null
  origin: string
  asOfDate: string | null
  assertedAt: string
}

/** A recorded, reasoned change to a control's applicability for this entity (TRD §13.3). */
export interface ExportOverride {
  originalApplicability: ApplicabilityResult
  rationale: string
  sourceRef: string | null
  by: string
  at: string
  expiresAt: string | null
}

export interface ExportControlInput {
  key: string
  title: string
  family: string
  standardClause: string | null
  wcagSc: string | null
  accessClass: string
  /** The *effective* applicability — the override result if one is active. */
  applicability: ApplicabilityResult
  applicabilityReason?: string | null
  readiness: ReadinessState
  approvedClaim: ExportApprovedClaim | null
  override?: ExportOverride | null
}

export interface PackSourceMetadata {
  authority: string
  catalogVersion: string
  publicationDate: string
  retrievedDate: string
  sourceChecksum: string
  sourceUrls: string[]
}

export interface BuildCanonicalExportInput {
  generatedAt: string
  entity: {
    id: string
    name: string
    identifier: string
    kind: string
    packKey: string
  }
  responsibleOrganization: string | null
  facts: Record<string, unknown>
  snapshotKey: string
  packSource: PackSourceMetadata
  evaluation: { id: string; hash: string; evaluatedAt: string }
  entityStatus: EntityStatus
  readinessCounts: Record<string, number>
  controls: ExportControlInput[]
}

export type ExportVerdictCode = 'EVIDENCE_READY_FOR_SNAPSHOT' | 'PARTIALLY_MET' | 'NOT_YET_MET'

export interface ExportVerdict {
  code: ExportVerdictCode
  statement: string
}

const LIMITATION =
  'This is a preparation and evidence record, not a certification, a conformity assessment, or a legal opinion. Responsibility for meeting the regulation remains with the organization.'

/** Map the deterministic entity status to export verdict language (no forbidden phrases). */
export function canonicalExportVerdict(status: EntityStatus, snapshotKey: string): ExportVerdict {
  switch (status) {
    case 'EVIDENCE_READY':
      return {
        code: 'EVIDENCE_READY_FOR_SNAPSHOT',
        statement: `Every required control has approved, source-linked evidence for control snapshot ${snapshotKey}. ${LIMITATION}`,
      }
    case 'REVIEW_NEEDED':
      return {
        code: 'PARTIALLY_MET',
        statement: `Some required controls have evidence prepared for control snapshot ${snapshotKey}; others have proposals awaiting review. Known limitations are listed below. ${LIMITATION}`,
      }
    case 'OUTDATED_SNAPSHOT':
      return {
        code: 'NOT_YET_MET',
        statement: `A newer control snapshot is available; this record is prepared against ${snapshotKey}. Known limitations are listed below. ${LIMITATION}`,
      }
    case 'BLOCKED':
    default:
      return {
        code: 'NOT_YET_MET',
        statement: `One or more required controls have no approved evidence, or have conflicting or stale evidence, for control snapshot ${snapshotKey}. Known limitations are listed below. ${LIMITATION}`,
      }
  }
}

const EXCEPTION_NOTE: Partial<Record<ReadinessState, string>> = {
  MISSING: 'No approved evidence has been recorded.',
  SELF_ATTESTED: 'An approved value exists but no supporting document is linked.',
  PENDING_REVIEW: 'A proposal exists but has not been reviewed.',
  CONFLICTING: 'Competing claims are unresolved.',
  STALE: 'The approved evidence is out of date and needs re-checking.',
  CONDITIONAL: 'Applicability depends on a fact that has not been supplied.',
}

export interface CanonicalExportControl {
  key: string
  title: string
  family: string
  standardClause: string | null
  wcagSc: string | null
  accessClass: string
  applicability: ApplicabilityResult
  applicabilityReason: string | null
  readiness: ReadinessState
  approvedClaim: ExportApprovedClaim | null
  override: ExportOverride | null
}

export interface CanonicalExportOverride {
  control: string
  from: ApplicabilityResult
  to: ApplicabilityResult
  rationale: string
  sourceRef: string | null
  by: string
  at: string
  expiresAt: string | null
}

export interface CanonicalExportException {
  control: string
  title: string
  readiness: ReadinessState
  note: string
}

export interface CanonicalExport {
  schemaVersion: string
  generatedAt: string
  pack: {
    key: string
    snapshotKey: string
    source: PackSourceMetadata
  }
  entity: {
    id: string
    name: string
    identifier: string
    kind: string
    responsibleOrganization: string | null
  }
  classificationFacts: Record<string, unknown>
  evaluation: { id: string; hash: string; evaluatedAt: string }
  verdict: ExportVerdict
  readinessCounts: Record<string, number>
  controls: CanonicalExportControl[]
  exceptions: CanonicalExportException[]
  /** Recorded applicability overrides in effect for this snapshot. */
  overrides: CanonicalExportOverride[]
}

/** Required controls that are not yet evidenced (excluded states never count). */
export function isExportException(c: {
  applicability: ApplicabilityResult
  readiness: ReadinessState
}): boolean {
  return (
    c.applicability === 'REQUIRED_BY_SNAPSHOT' &&
    c.readiness !== 'EVIDENCED' &&
    c.readiness !== 'NOT_APPLICABLE' &&
    c.readiness !== 'NOT_YET_REQUIRED'
  )
}

export function buildCanonicalExport(input: BuildCanonicalExportInput): CanonicalExport {
  const controls: CanonicalExportControl[] = [...input.controls]
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((c) => ({
      key: c.key,
      title: c.title,
      family: c.family,
      standardClause: c.standardClause,
      wcagSc: c.wcagSc,
      accessClass: c.accessClass,
      applicability: c.applicability,
      applicabilityReason: c.applicabilityReason ?? null,
      readiness: c.readiness,
      approvedClaim: c.approvedClaim,
      override: c.override ?? null,
    }))

  const exceptions: CanonicalExportException[] = controls.filter(isExportException).map((c) => ({
    control: c.key,
    title: c.title,
    readiness: c.readiness,
    note: EXCEPTION_NOTE[c.readiness] ?? 'Not yet evidenced.',
  }))

  const overrides: CanonicalExportOverride[] = controls
    .filter((c) => c.override)
    .map((c) => ({
      control: c.key,
      from: c.override!.originalApplicability,
      to: c.applicability,
      rationale: c.override!.rationale,
      sourceRef: c.override!.sourceRef,
      by: c.override!.by,
      at: c.override!.at,
      expiresAt: c.override!.expiresAt,
    }))

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    generatedAt: input.generatedAt,
    pack: {
      key: input.entity.packKey,
      snapshotKey: input.snapshotKey,
      source: input.packSource,
    },
    entity: {
      id: input.entity.id,
      name: input.entity.name,
      identifier: input.entity.identifier,
      kind: input.entity.kind,
      responsibleOrganization: input.responsibleOrganization,
    },
    classificationFacts: input.facts,
    evaluation: input.evaluation,
    verdict: canonicalExportVerdict(input.entityStatus, input.snapshotKey),
    readinessCounts: input.readinessCounts,
    controls,
    exceptions,
    overrides,
  }
}

/** The control-matrix CSV rendering of a frozen export (engine TRD §14.2). */
export function canonicalExportToCsv(doc: CanonicalExport): string {
  const header = [
    'control',
    'title',
    'family',
    'standard_clause',
    'wcag_sc',
    'applicability',
    'readiness',
    'approved_value',
    'approved_unit',
    'approved_origin',
  ]
  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v)
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows = doc.controls.map((c) =>
    [
      c.key,
      c.title,
      c.family,
      c.standardClause,
      c.wcagSc,
      c.applicability,
      c.readiness,
      c.approvedClaim?.value ?? '',
      c.approvedClaim?.unit ?? '',
      c.approvedClaim?.origin ?? '',
    ]
      .map(escape)
      .join(','),
  )
  return [header.join(','), ...rows].join('\r\n') + '\r\n'
}
