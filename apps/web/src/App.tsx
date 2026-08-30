import type { ReactElement } from 'react'
import { READINESS_STATES } from '@rre/domain'
import { ReadinessChip } from '@rre/ui'

/**
 * Placeholder shell. The operator, contributor, and reviewer routes are built
 * per the engine detailed design (documents 01–03) starting in Slice 1.
 */
export function App(): ReactElement {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 720 }}>
      <h1>Regulatory Readiness Engine</h1>
      <p>
        Evidence preparation for a specific regulation — not legal certification or authority
        approval.
      </p>
      <p>Scaffold only. Screens land per the engine detailed design.</p>

      <h2>Readiness vocabulary</h2>
      <ul style={{ display: 'grid', gap: '0.5rem', listStyle: 'none', padding: 0 }}>
        {READINESS_STATES.map((state) => (
          <li key={state}>
            <ReadinessChip state={state} />
          </li>
        ))}
      </ul>
    </main>
  )
}
