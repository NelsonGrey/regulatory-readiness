/**
 * Pack loader and validator (ADR 0005). Reads a `packs/<pack-key>/` directory,
 * Zod-validates every artifact file, computes the content checksum, and runs the
 * structural + known-outcome checks.
 */
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  ApplicabilityRuleSet,
  ControlsFile,
  CopyStringsFile,
  EntityFactsSchemaFile,
  PackManifest,
  TestVectorsFile,
  type ApplicabilityResult,
  type ControlDefinition,
} from '@rre/contracts'
import { evaluateApplicability, type EntityFacts } from './applicability.js'

export interface LoadedPack {
  path: string
  manifest: PackManifest
  controls: ControlDefinition[]
  entityFacts: EntityFactsSchemaFile
  applicability: ApplicabilityRuleSet
  testVectors: TestVectorsFile
  copy: CopyStringsFile
  /** `sha256:<hex>` over the canonical form of the pack's data files. */
  computedChecksum: string
}

export class PackLoadError extends Error {
  constructor(
    readonly dir: string,
    message: string,
  ) {
    super(`pack at ${dir}: ${message}`)
    this.name = 'PackLoadError'
  }
}

export interface PackValidationIssue {
  severity: 'error' | 'warning'
  code: string
  message: string
}

export interface PackValidationResult {
  ok: boolean
  issues: PackValidationIssue[]
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown
  } catch (err) {
    throw new Error(`could not read/parse ${path}: ${String(err)}`)
  }
}

/** Recursively sort object keys so serialization is stable. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === 'object') {
    const src = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(src).sort()) out[key] = canonicalize(src[key])
    return out
  }
  return value
}

export async function loadPack(dir: string): Promise<LoadedPack> {
  const manifest = PackManifest.parse(await readJson(join(dir, 'manifest.json')))
  const controlsFile = ControlsFile.parse(await readJson(join(dir, 'controls.json')))
  const entityFacts = EntityFactsSchemaFile.parse(
    await readJson(join(dir, 'entity-facts.schema.json')),
  )
  const applicability = ApplicabilityRuleSet.parse(
    await readJson(join(dir, 'applicability', 'rules.json')),
  )
  const testVectors = TestVectorsFile.parse(await readJson(join(dir, 'test-vectors.json')))
  const copy = CopyStringsFile.parse(await readJson(join(dir, 'copy', 'strings.json')))

  const filePackKeys = {
    controls: controlsFile.packKey,
    'entity-facts': entityFacts.packKey,
    applicability: applicability.packKey,
    'test-vectors': testVectors.packKey,
    copy: copy.packKey,
  }
  for (const [file, key] of Object.entries(filePackKeys)) {
    if (key !== manifest.packKey) {
      throw new PackLoadError(
        dir,
        `${file}.packKey "${key}" != manifest.packKey "${manifest.packKey}"`,
      )
    }
  }

  const { sourceChecksum: _checksum, review: _review, ...manifestCore } = manifest
  const canonical = JSON.stringify(
    canonicalize({
      manifestCore,
      controls: controlsFile.controls,
      entityFacts,
      applicability,
      testVectors,
      copy,
    }),
  )
  const computedChecksum = `sha256:${createHash('sha256').update(canonical).digest('hex')}`

  return {
    path: dir,
    manifest,
    controls: controlsFile.controls,
    entityFacts,
    applicability,
    testVectors,
    copy,
    computedChecksum,
  }
}

export function validatePack(pack: LoadedPack): PackValidationResult {
  const issues: PackValidationIssue[] = []
  const error = (code: string, message: string): void => {
    issues.push({ severity: 'error', code, message })
  }
  const warn = (code: string, message: string): void => {
    issues.push({ severity: 'warning', code, message })
  }

  // 1. Declared vs actual control count.
  if (pack.testVectors.controlCount !== pack.controls.length) {
    error(
      'CONTROL_COUNT',
      `test-vectors.controlCount is ${pack.testVectors.controlCount} but controls.json has ${pack.controls.length}`,
    )
  }

  // 2. Unique control keys.
  const seen = new Set<string>()
  const dups = new Set<string>()
  for (const c of pack.controls) {
    if (seen.has(c.key)) dups.add(c.key)
    seen.add(c.key)
  }
  if (dups.size > 0) error('DUPLICATE_CONTROL_KEY', `duplicate keys: ${[...dups].join(', ')}`)

  // 3. Applicability rules reference known controls / families.
  const families = new Set(pack.controls.map((c) => c.family))
  for (const rule of pack.applicability.rules) {
    const t = rule.target
    if (t === '*') continue
    if ('family' in t && !families.has(t.family)) {
      error('UNKNOWN_FAMILY', `rule "${rule.id}" targets unknown family "${t.family}"`)
    }
    if ('controls' in t) {
      for (const key of t.controls) {
        if (!seen.has(key)) {
          error('UNKNOWN_CONTROL', `rule "${rule.id}" targets unknown control "${key}"`)
        }
      }
    }
  }

  // 4. Checksum.
  if (pack.manifest.sourceChecksum !== pack.computedChecksum) {
    if (pack.manifest.status === 'active') {
      error(
        'CHECKSUM_MISMATCH',
        `manifest.sourceChecksum does not match the computed checksum (${pack.computedChecksum})`,
      )
    } else {
      warn(
        'CHECKSUM_UNVERIFIED',
        `manifest.sourceChecksum is not yet set to the computed value (${pack.computedChecksum})`,
      )
    }
  }

  // 5. Two-person review gate for activation (ADR 0005).
  if (pack.manifest.status === 'active' && pack.manifest.review.reviewers.length < 2) {
    error('REVIEW_GATE', 'an active pack requires at least two named reviewers in manifest.review')
  }

  // 6. Known-outcome applicability vectors.
  const controlIndex = pack.controls.map((c) => ({ key: c.key, family: c.family }))
  for (const vector of pack.testVectors.applicability) {
    const results = evaluateApplicability(
      pack.applicability,
      controlIndex,
      vector.facts as EntityFacts,
      {
        snapshotKey: vector.snapshotKey,
      },
    )
    const byKey = new Map(results.map((r) => [r.control, r.result]))
    for (const expected of vector.expect) {
      const actual: ApplicabilityResult | undefined = byKey.get(expected.control)
      if (actual !== expected.result) {
        error(
          'TEST_VECTOR',
          `vector "${vector.name}": ${expected.control} expected ${expected.result}, got ${actual ?? 'NO_RESULT'}`,
        )
      }
    }
  }

  // 7. Copy hygiene.
  if (pack.copy.forbiddenPhrases.length === 0) {
    warn('NO_FORBIDDEN_PHRASES', 'copy.forbiddenPhrases is empty')
  }

  return { ok: issues.every((i) => i.severity !== 'error'), issues }
}

export interface FactIssue {
  fact: string
  code: 'REQUIRED' | 'TYPE' | 'ENUM' | 'UNKNOWN'
  message: string
}

/** Validate an entity's facts against a pack's `entity-facts.schema.json`. */
export function validateEntityFacts(
  schema: EntityFactsSchemaFile,
  facts: Record<string, unknown>,
): FactIssue[] {
  const issues: FactIssue[] = []
  const defined = new Set(schema.facts.map((f) => f.name))

  for (const def of schema.facts) {
    const value = facts[def.name]
    if (value === undefined || value === null) {
      if (def.required) {
        issues.push({ fact: def.name, code: 'REQUIRED', message: `fact "${def.name}" is required` })
      }
      continue
    }
    if (def.type === 'boolean' && typeof value !== 'boolean') {
      issues.push({ fact: def.name, code: 'TYPE', message: `fact "${def.name}" must be a boolean` })
    }
    if (def.type === 'number' && typeof value !== 'number') {
      issues.push({ fact: def.name, code: 'TYPE', message: `fact "${def.name}" must be a number` })
    }
    if ((def.type === 'string' || def.type === 'enum') && typeof value !== 'string') {
      issues.push({ fact: def.name, code: 'TYPE', message: `fact "${def.name}" must be a string` })
    }
    if (
      def.type === 'enum' &&
      def.enumValues &&
      typeof value === 'string' &&
      !def.enumValues.includes(value)
    ) {
      issues.push({
        fact: def.name,
        code: 'ENUM',
        message: `fact "${def.name}" must be one of: ${def.enumValues.join(', ')}`,
      })
    }
  }

  for (const key of Object.keys(facts)) {
    if (!defined.has(key)) {
      issues.push({ fact: key, code: 'UNKNOWN', message: `unknown fact "${key}"` })
    }
  }

  return issues
}

export interface InstalledPack {
  packKey: string
  path: string
  manifest: PackManifest | null
  loaded: LoadedPack | null
  valid: boolean
  issues: PackValidationIssue[]
  computedChecksum: string
}

/** Load and validate every pack directory under `packsRoot`. */
export async function loadInstalledPacks(packsRoot: string): Promise<InstalledPack[]> {
  const entries = await readdir(packsRoot, { withFileTypes: true }).catch(() => null)
  if (!entries) return []

  const out: InstalledPack[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = join(packsRoot, entry.name)
    try {
      const loaded = await loadPack(dir)
      const { ok, issues } = validatePack(loaded)
      out.push({
        packKey: loaded.manifest.packKey,
        path: dir,
        manifest: loaded.manifest,
        loaded,
        valid: ok,
        issues,
        computedChecksum: loaded.computedChecksum,
      })
    } catch (err) {
      out.push({
        packKey: entry.name,
        path: dir,
        manifest: null,
        loaded: null,
        valid: false,
        issues: [{ severity: 'error', code: 'LOAD_FAILED', message: String(err) }],
        computedChecksum: '',
      })
    }
  }
  return out.sort((a, b) => a.packKey.localeCompare(b.packKey))
}
