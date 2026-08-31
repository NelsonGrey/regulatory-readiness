import { useState, type FormEvent, type ReactElement } from 'react'
import { api } from '../api/client.js'

const RESULTS = [
  'REQUIRED_BY_SNAPSHOT',
  'OPTIONAL_IF_AVAILABLE',
  'CONDITIONAL_FACT_REQUIRED',
  'NOT_YET_REQUIRED_BY_SNAPSHOT',
  'DUPLICATE_SOURCE_FIELD',
  'NOT_APPLICABLE_TO_CLASSIFICATION',
  'NEEDS_SPECIALIST_REVIEW',
] as const

export interface OverrideFormProps {
  entityId: string
  control: string
  onDone: () => void
  onCancel: () => void
}

/**
 * OVR-001 — record a reasoned applicability override for one control. It never
 * changes the control snapshot; readiness derivation layers it on top.
 */
export function OverrideForm({
  entityId,
  control,
  onDone,
  onCancel,
}: OverrideFormProps): ReactElement {
  const [result, setResult] = useState<(typeof RESULTS)[number]>('NOT_APPLICABLE_TO_CLASSIFICATION')
  const [rationale, setRationale] = useState('')
  const [sourceRef, setSourceRef] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post(`/entities/${entityId}/controls/${control}/applicability-override`, {
        result,
        rationale,
        sourceRef: sourceRef.trim() || undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the override')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="rre-panel"
      onSubmit={submit}
      aria-label={`Override applicability for ${control}`}
    >
      <h3>
        Override applicability for <code>{control}</code>
      </h3>
      <p className="rre-note">
        This does not change the control snapshot. It is recorded with your name, the time, and the
        rationale, and it shows on the matrix and every export.
      </p>
      <div className="rre-field">
        <label htmlFor="ovr-result">New applicability</label>
        <select
          id="ovr-result"
          value={result}
          onChange={(e) => setResult(e.target.value as (typeof RESULTS)[number])}
        >
          {RESULTS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div className="rre-field">
        <label htmlFor="ovr-rationale">Rationale *</label>
        <input
          id="ovr-rationale"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          required
          minLength={3}
        />
      </div>
      <div className="rre-field">
        <label htmlFor="ovr-source">Specialist / source reference</label>
        <input id="ovr-source" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
      </div>
      <div className="rre-field">
        <label htmlFor="ovr-expires">Review by (optional)</label>
        <input
          id="ovr-expires"
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
      </div>
      {error ? (
        <p className="rre-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="rre-actions">
        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Record override'}
        </button>
        <button type="button" className="rre-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
