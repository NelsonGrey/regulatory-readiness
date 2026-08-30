import type { ReactElement } from 'react'

/** Short user label per applicability result (engine TRD §7.2). */
const LABELS: Record<string, string> = {
  REQUIRED_BY_SNAPSHOT: 'Required',
  OPTIONAL_IF_AVAILABLE: 'Optional',
  CONDITIONAL_FACT_REQUIRED: 'Needs a fact',
  NOT_YET_REQUIRED_BY_SNAPSHOT: 'Not yet required',
  DUPLICATE_SOURCE_FIELD: 'Duplicate source',
  NOT_APPLICABLE_TO_CLASSIFICATION: 'Not applicable',
  NEEDS_SPECIALIST_REVIEW: 'Specialist review',
}

export interface ApplicabilityChipProps {
  result: string
}

/**
 * Renders an applicability result as text (colour is applied via CSS on
 * `data-result` — never colour alone). Throws on an unknown result so a missing
 * case is a build/test failure, not a silent default.
 */
export function ApplicabilityChip({ result }: ApplicabilityChipProps): ReactElement {
  const label = LABELS[result]
  if (!label) throw new Error(`ApplicabilityChip: unknown applicability result "${result}"`)
  return (
    <span className="rre-applicability-chip" data-result={result}>
      {label}
    </span>
  )
}
