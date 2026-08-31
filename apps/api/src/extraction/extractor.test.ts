import { describe, expect, it } from 'vitest'
import { keywordExtractor, type ExtractionControl } from './extractor.js'

const controls: ExtractionControl[] = [
  { key: 'EAA-VOLT', title: 'Nominal voltage', hints: ['Nominal voltage', 'voltage'] },
  { key: 'EAA-STMT', title: 'Accessibility statement URL', hints: ['statement', 'url'] },
]

describe('keywordExtractor', () => {
  it('proposes a value + unit for a labelled line matching a control hint', async () => {
    const text = [
      'Product datasheet',
      'Nominal voltage: 48 V',
      'Accessibility statement URL: https://acme.example/a11y',
      'Colour: blue',
    ].join('\n')

    const out = await keywordExtractor().extract({ documentId: 'doc_1', text, controls })
    expect(out).toEqual([
      expect.objectContaining({
        controlKey: 'EAA-VOLT',
        value: '48',
        unit: 'V',
        location: { page: null, quote: 'Nominal voltage: 48 V' },
      }),
      expect.objectContaining({
        controlKey: 'EAA-STMT',
        value: 'https://acme.example/a11y',
        unit: null,
      }),
    ])
    expect(out[0]?.confidence).toBeGreaterThan(0)
  })

  it('returns nothing when no line matches a control', async () => {
    const out = await keywordExtractor().extract({
      documentId: 'doc_1',
      text: 'Weather: sunny\nMood: good',
      controls,
    })
    expect(out).toEqual([])
  })

  it('takes only the first match per control', async () => {
    const text = 'Nominal voltage: 12 V\nNominal voltage: 48 V'
    const out = await keywordExtractor().extract({ documentId: 'doc_1', text, controls })
    expect(out).toHaveLength(1)
    expect(out[0]?.value).toBe('12')
  })
})
