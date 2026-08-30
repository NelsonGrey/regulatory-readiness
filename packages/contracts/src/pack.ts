/**
 * Schemas for the control-pack artifact files (ENGINE_CONCEPT §5, ADR 0005).
 * `@rre/control-catalog` validates every pack against these at load time.
 */
import { z, IsoDate, AccessClass, ApplicabilityResult } from './common.js'

/** `manifest.json`. */
export const PackManifest = z.object({
  packKey: z.string().regex(/^[a-z0-9-]+$/, 'lowercase kebab-case'),
  title: z.string().min(1),
  sourceAuthority: z.string().min(1),
  jurisdiction: z.string().min(1),
  sourceUrls: z.array(z.string().url()).min(1),
  publicationDate: IsoDate,
  retrievedDate: z.union([IsoDate, z.literal('TBD')]),
  sourceChecksum: z.string().min(1),
  catalogVersion: z.string().min(1),
  snapshotKey: z.string().min(1),
  effectiveDates: z.array(z.object({ label: z.string(), date: IsoDate })).default([]),
  supersedes: z.string().nullable().default(null),
  supersededBy: z.string().nullable().default(null),
  status: z.enum(['draft', 'in-review', 'active', 'superseded']),
  review: z
    .object({
      reviewers: z.array(z.string()).default([]),
      reviewedAt: z.union([IsoDate, z.null()]).default(null),
      sourceSetHash: z.union([z.string(), z.null()]).default(null),
    })
    .default({ reviewers: [], reviewedAt: null, sourceSetHash: null }),
})
export type PackManifest = z.infer<typeof PackManifest>

/** One control record in `controls.json`. */
export const ControlDefinition = z.object({
  key: z.string().regex(/^[A-Z0-9][A-Z0-9-]*$/, 'UPPER-KEBAB key'),
  title: z.string().min(1),
  family: z.string().min(1),
  fieldFamily: z.string().min(1),
  standardClause: z.string().nullable().default(null),
  wcagSc: z.string().nullable().default(null),
  wcagVersionMin: z.enum(['2.1', '2.2']).default('2.1'),
  accessClassDefault: AccessClass.default('PUBLIC_CANDIDATE'),
  evidenceExpectation: z.string().min(1),
  notes: z.string().optional(),
})
export type ControlDefinition = z.infer<typeof ControlDefinition>

export const ControlsFile = z.object({
  packKey: z.string(),
  controls: z.array(ControlDefinition).min(1),
})
export type ControlsFile = z.infer<typeof ControlsFile>

/** Scalar a fact may hold. */
export const FactValue = z.union([z.string(), z.number(), z.boolean(), z.null()])
export type FactValue = z.infer<typeof FactValue>

/** Deterministic, inspectable applicability expression — engine TRD §7.3. */
export type ApplicabilityExpression =
  | { all: ApplicabilityExpression[] }
  | { any: ApplicabilityExpression[] }
  | { not: ApplicabilityExpression }
  | { fact: string; in: FactValue[] }
  | { fact: string; eq: FactValue }
  | { known: string }
  | { snapshot: string }
  | { always: true }

export const ApplicabilityExpression: z.ZodType<ApplicabilityExpression> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(ApplicabilityExpression) }),
    z.object({ any: z.array(ApplicabilityExpression) }),
    z.object({ not: ApplicabilityExpression }),
    z.object({ fact: z.string(), in: z.array(FactValue) }),
    z.object({ fact: z.string(), eq: FactValue }),
    z.object({ known: z.string() }),
    z.object({ snapshot: z.string() }),
    z.object({ always: z.literal(true) }),
  ]),
)

/** Which controls a rule targets. */
export const RuleTarget = z.union([
  z.literal('*'),
  z.object({ family: z.string().min(1) }),
  z.object({ controls: z.array(z.string()).min(1) }),
])
export type RuleTarget = z.infer<typeof RuleTarget>

export const ApplicabilityRule = z.object({
  id: z.string().min(1),
  description: z.string().optional(),
  when: ApplicabilityExpression,
  target: RuleTarget,
  result: ApplicabilityResult,
  reason: z.string().optional(),
})
export type ApplicabilityRule = z.infer<typeof ApplicabilityRule>

/** `applicability/rules.json`. First matching rule per control wins; else `defaultResult`. */
export const ApplicabilityRuleSet = z.object({
  packKey: z.string(),
  defaultResult: ApplicabilityResult,
  rules: z.array(ApplicabilityRule),
})
export type ApplicabilityRuleSet = z.infer<typeof ApplicabilityRuleSet>

export const EntityFactDef = z.object({
  name: z.string().min(1),
  type: z.enum(['boolean', 'string', 'number', 'enum', 'object']),
  enumValues: z.array(z.string()).optional(),
  required: z.boolean().default(false),
  description: z.string().optional(),
})
export type EntityFactDef = z.infer<typeof EntityFactDef>

export const EntityFactsSchemaFile = z.object({
  packKey: z.string(),
  facts: z.array(EntityFactDef).min(1),
})
export type EntityFactsSchemaFile = z.infer<typeof EntityFactsSchemaFile>

export const ApplicabilityExpectation = z.object({
  name: z.string(),
  facts: z.record(FactValue),
  snapshotKey: z.string(),
  expect: z.array(z.object({ control: z.string(), result: ApplicabilityResult })).min(1),
})
export type ApplicabilityExpectation = z.infer<typeof ApplicabilityExpectation>

/** `test-vectors.json` — known outcomes the loader checks. */
export const TestVectorsFile = z.object({
  packKey: z.string(),
  controlCount: z.number().int().nonnegative(),
  applicability: z.array(ApplicabilityExpectation).default([]),
})
export type TestVectorsFile = z.infer<typeof TestVectorsFile>

/** `copy/strings.json`. */
export const CopyStringsFile = z.object({
  packKey: z.string(),
  limitationStatement: z.string().min(1),
  forbiddenPhrases: z.array(z.string()).default([]),
  verdict: z.object({ ready: z.string(), notReady: z.string() }),
})
export type CopyStringsFile = z.infer<typeof CopyStringsFile>
