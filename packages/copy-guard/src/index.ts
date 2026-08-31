export const forbiddenMarketingPhrases = [
  'compliant',
  'compliance made easy',
  'become compliant',
  'get compliant',
  'guaranteed compliance',
  'compliance guaranteed',
  'certified',
  'audit-proof',
  'audit passed',
  'risk-free',
  'fully accessible',
  '100% accessible',
  'instantly compliant',
  'one line of code',
  'meets all legal requirements',
  'legal compliance',
  'we make you compliant',
] as const

export type CopyGuardFinding = { phrase: string; index: number }

export function scanMarketingCopy(text: string): CopyGuardFinding[] {
  const lower = text.toLocaleLowerCase('en')
  return forbiddenMarketingPhrases.flatMap((phrase) => {
    const findings: CopyGuardFinding[] = []
    let from = 0
    while (from < lower.length) {
      const index = lower.indexOf(phrase, from)
      if (index < 0) break
      findings.push({ phrase, index })
      from = index + phrase.length
    }
    return findings
  })
}
