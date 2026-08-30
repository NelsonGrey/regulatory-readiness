import type { ReactElement } from 'react'
import type { ReadinessState } from '@rre/domain'

/** User-facing label + icon glyph per readiness state (engine detailed design 01 §8). */
const PRESENTATION: Record<ReadinessState, { label: string; glyph: string }> = {
  EVIDENCED: { label: 'Evidenced', glyph: '✓' },
  MISSING: { label: 'Missing', glyph: '!' },
  CONFLICTING: { label: 'Conflict', glyph: '⚠' },
  STALE: { label: 'Stale', glyph: '◷' },
  PENDING_REVIEW: { label: 'Review needed', glyph: '⧗' },
  CONDITIONAL: { label: 'Needs scope decision', glyph: '?' },
  NOT_YET_REQUIRED: { label: 'Not required for this snapshot', glyph: '–' },
  NOT_APPLICABLE: { label: 'Not applicable', glyph: '–' },
}

export interface ReadinessChipProps {
  state: ReadinessState
  /** Optional human explanation surfaced via the chip's accessible description. */
  reason?: string
}

/**
 * Renders a readiness state as text + glyph (colour is applied via CSS on the
 * `data-state` attribute — never colour alone). Throws on an unknown state so a
 * missing case is a build/test failure, not a silent default chip.
 */
export function ReadinessChip({ state, reason }: ReadinessChipProps): ReactElement {
  const p = PRESENTATION[state]
  if (!p) throw new Error(`ReadinessChip: unhandled readiness state "${state}"`)

  return (
    <span className="rre-readiness-chip" data-state={state} title={reason}>
      <span aria-hidden="true">{p.glyph}</span>
      <span>{p.label}</span>
      {reason ? <span className="rre-visually-hidden">{`: ${reason}`}</span> : null}
    </span>
  )
}
