/**
 * Deterministic validators for an extracted proposal (engine TRD §11.5). Range
 * checks *warn*; they do not establish correctness. An `error` blocks acceptance;
 * a `warn` is surfaced but does not.
 */
export interface ValidationFinding {
  level: 'error' | 'warn'
  code: string
  message: string
}

export interface ProposalToValidate {
  value: string
  unit: string | null
  /** From the pack control, if known — e.g. "date", "number", "url", "text". */
  expectedType?: string
}

export function validateProposal(p: ProposalToValidate): ValidationFinding[] {
  const findings: ValidationFinding[] = []
  const value = p.value.trim()

  if (value === '') {
    findings.push({ level: 'error', code: 'EMPTY', message: 'the proposed value is empty' })
    return findings
  }

  switch (p.expectedType) {
    case 'date':
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        findings.push({
          level: 'warn',
          code: 'DATE_FORMAT',
          message: 'expected an ISO date (YYYY-MM-DD)',
        })
      }
      break
    case 'number':
      if (!/^-?\d+(\.\d+)?$/.test(value)) {
        findings.push({ level: 'warn', code: 'NOT_NUMERIC', message: 'expected a number' })
      } else if (!p.unit) {
        findings.push({ level: 'warn', code: 'NO_UNIT', message: 'a numeric value has no unit' })
      }
      break
    case 'url':
      try {
        new URL(value)
      } catch {
        findings.push({ level: 'warn', code: 'NOT_URL', message: 'expected a URL' })
      }
      break
    default:
      break
  }

  return findings
}

export const hasBlockingError = (findings: readonly ValidationFinding[]): boolean =>
  findings.some((f) => f.level === 'error')
