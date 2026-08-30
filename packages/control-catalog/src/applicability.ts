/**
 * Deterministic applicability evaluation (engine TRD §7.3).
 *
 * A rule's `when` expression evaluates to `true`, `false`, or `unknown`.
 * `unknown` means "depends on a fact that was not provided" — the engine maps it
 * to `CONDITIONAL_FACT_REQUIRED`, never to a guess.
 *
 * Pure: same inputs → same output.
 */
import type {
  ApplicabilityExpression,
  ApplicabilityResult,
  ApplicabilityRuleSet,
  FactValue,
  RuleTarget,
} from '@rre/contracts'

export type EntityFacts = Record<string, FactValue | undefined>

export interface EvaluateOptions {
  snapshotKey: string
}

export type ExpressionResult = true | false | 'unknown'

export function evaluateExpression(
  expr: ApplicabilityExpression,
  facts: EntityFacts,
  opts: EvaluateOptions,
): ExpressionResult {
  if ('always' in expr) return true
  if ('snapshot' in expr) return expr.snapshot === opts.snapshotKey
  if ('known' in expr) {
    const v = facts[expr.known]
    return v !== undefined && v !== null
  }
  if ('all' in expr) {
    let unknown = false
    for (const sub of expr.all) {
      const r = evaluateExpression(sub, facts, opts)
      if (r === false) return false
      if (r === 'unknown') unknown = true
    }
    return unknown ? 'unknown' : true
  }
  if ('any' in expr) {
    let unknown = false
    for (const sub of expr.any) {
      const r = evaluateExpression(sub, facts, opts)
      if (r === true) return true
      if (r === 'unknown') unknown = true
    }
    return unknown ? 'unknown' : false
  }
  if ('not' in expr) {
    const r = evaluateExpression(expr.not, facts, opts)
    return r === 'unknown' ? 'unknown' : !r
  }
  // Fact predicate: { fact, in } or { fact, eq }
  const value = facts[expr.fact]
  if (value === undefined) return 'unknown'
  if ('in' in expr) return expr.in.includes(value)
  return value === expr.eq
}

interface TargetableControl {
  key: string
  family: string
}

function ruleTargets(target: RuleTarget, control: TargetableControl): boolean {
  if (target === '*') return true
  if ('family' in target) return target.family === control.family
  return target.controls.includes(control.key)
}

export interface ControlApplicability {
  control: string
  result: ApplicabilityResult
  reason?: string
  ruleId?: string
}

/**
 * Evaluate applicability for every control. First rule whose target matches the
 * control and whose `when` is `true` wins; an `unknown` on a matching rule yields
 * `CONDITIONAL_FACT_REQUIRED`; if no rule matches, `ruleSet.defaultResult`.
 */
export function evaluateApplicability(
  ruleSet: ApplicabilityRuleSet,
  controls: readonly TargetableControl[],
  facts: EntityFacts,
  opts: EvaluateOptions,
): ControlApplicability[] {
  return controls.map((control) => {
    for (const rule of ruleSet.rules) {
      if (!ruleTargets(rule.target, control)) continue
      const r = evaluateExpression(rule.when, facts, opts)
      if (r === true) {
        return { control: control.key, result: rule.result, reason: rule.reason, ruleId: rule.id }
      }
      if (r === 'unknown') {
        return {
          control: control.key,
          result: 'CONDITIONAL_FACT_REQUIRED',
          reason: 'Applicability depends on a fact that has not been provided.',
          ruleId: rule.id,
        }
      }
      // r === false → try the next rule
    }
    return { control: control.key, result: ruleSet.defaultResult }
  })
}
