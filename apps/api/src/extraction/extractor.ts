/**
 * Extraction adapter (engine TRD §11). A structured extractor proposes a value,
 * unit, method, and an evidence location per candidate control. Every proposal
 * MUST carry a source location — a proposal with none cannot be accepted.
 *
 * The default `keywordExtractor` is deterministic and model-free: it scans the
 * document text for `"<phrase>: <value>"` lines and matches the phrase against a
 * control's title / key words. The production adapter (Bedrock + Textract) plugs
 * in behind the same port and is a later `GATE`.
 */

export interface ExtractionControl {
  key: string
  title: string
  /** Words that, if present in a line's label, point at this control. */
  hints: string[]
}

export interface ExtractionInput {
  documentId: string
  /** Normalised UTF-8 text of the document (a derivative). */
  text: string
  controls: ExtractionControl[]
}

export interface ProposedValue {
  controlKey: string
  value: string
  unit: string | null
  method: string | null
  confidence: number
  /** REQUIRED — a proposal with no location cannot be accepted (TRD §11). */
  location: { page: number | null; quote: string }
}

export interface Extractor {
  readonly name: string
  readonly modelId: string
  readonly schemaVersion: string
  extract(input: ExtractionInput): Promise<ProposedValue[]>
}

const LINE = /^\s*([^:\n]{2,80}?)\s*:\s*(.+?)\s*$/
const UNIT_SUFFIX = /\s+([A-Za-z%µ/]+(?:\s?[A-Za-z%µ/]+)?)$/

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Deterministic, model-free extractor over `label: value` lines. */
export function keywordExtractor(): Extractor {
  return {
    name: 'keyword',
    modelId: 'keyword-lines@1',
    schemaVersion: '1.0',
    async extract({ text, controls }): Promise<ProposedValue[]> {
      const lines = text.split(/\r?\n/)
      const proposals: ProposedValue[] = []
      const seen = new Set<string>()

      lines.forEach((raw, i) => {
        const m = LINE.exec(raw)
        if (!m) return
        const label = normalise(m[1]!)
        const rawValue = m[2]!.trim()
        if (!label || !rawValue) return

        for (const c of controls) {
          if (seen.has(c.key)) continue
          const hitsHint = c.hints.some((h) => label.includes(normalise(h)))
          if (!hitsHint) continue

          let value = rawValue
          let unit: string | null = null
          const um = UNIT_SUFFIX.exec(rawValue)
          if (um && /\d/.test(rawValue)) {
            value = rawValue.slice(0, um.index).trim()
            unit = um[1]!.trim()
          }

          proposals.push({
            controlKey: c.key,
            value,
            unit,
            method: `line ${i + 1} of the document`,
            confidence: 0.6,
            location: { page: null, quote: raw.trim().slice(0, 500) },
          })
          seen.add(c.key)
        }
      })

      return proposals
    },
  }
}
