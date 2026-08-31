/**
 * Diff two scope evaluations of the same entity (engine TRD §7.4 — the
 * `ControlChange` shape, applied to a re-evaluation rather than a snapshot
 * migration). Pure and order-independent.
 */
import type { ApplicabilityResult } from '@rre/contracts'

export interface ControlApplicabilityChange {
  control: string
  from: ApplicabilityResult
  to: ApplicabilityResult
}

export interface EvaluationDiff {
  /** Controls present after but not before. */
  added: string[]
  /** Controls present before but not after. */
  removed: string[]
  /** Same control, different applicability result. */
  applicabilityChanged: ControlApplicabilityChange[]
  /** Count of controls whose result is unchanged. */
  unchanged: number
}

type ResultRow = { control: string; result: ApplicabilityResult }

export function diffEvaluations(
  before: readonly ResultRow[],
  after: readonly ResultRow[],
): EvaluationDiff {
  const beforeByControl = new Map(before.map((r) => [r.control, r.result]))
  const afterByControl = new Map(after.map((r) => [r.control, r.result]))

  const added: string[] = []
  const applicabilityChanged: ControlApplicabilityChange[] = []
  let unchanged = 0

  for (const [control, to] of afterByControl) {
    const from = beforeByControl.get(control)
    if (from === undefined) {
      added.push(control)
    } else if (from !== to) {
      applicabilityChanged.push({ control, from, to })
    } else {
      unchanged++
    }
  }

  const removed = [...beforeByControl.keys()].filter((c) => !afterByControl.has(c))

  added.sort()
  removed.sort()
  applicabilityChanged.sort((a, b) => (a.control < b.control ? -1 : a.control > b.control ? 1 : 0))

  return { added, removed, applicabilityChanged, unchanged }
}

export const evaluationDiffIsEmpty = (d: EvaluationDiff): boolean =>
  d.added.length === 0 && d.removed.length === 0 && d.applicabilityChanged.length === 0

export interface ControlSetDiff {
  /** Control keys in `to` but not `from`. */
  added: string[]
  /** Control keys in `from` but not `to`. */
  removed: string[]
  /** Control keys present in both. */
  retained: string[]
}

/** Diff two sets of control keys (a snapshot's control roster changing). */
export function diffControlSets(from: readonly string[], to: readonly string[]): ControlSetDiff {
  const fromSet = new Set(from)
  const toSet = new Set(to)
  return {
    added: [...toSet].filter((k) => !fromSet.has(k)).sort(),
    removed: [...fromSet].filter((k) => !toSet.has(k)).sort(),
    retained: [...toSet].filter((k) => fromSet.has(k)).sort(),
  }
}
