import { useState, type FormEvent, type ReactElement } from 'react'
import { api } from '../api/client.js'

export interface AddClaimFormProps {
  entityId: string
  control: string
  /** Pack-authored guidance for this control — what good evidence looks like. */
  evidenceExpectation?: string | null
  onDone: () => void
  onCancel: () => void
}

/** MAT-002 — assert a claim against one control. It enters review, it is not approved (engine §6). */
export function AddClaimForm({
  entityId,
  control,
  evidenceExpectation,
  onDone,
  onCancel,
}: AddClaimFormProps): ReactElement {
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post(`/entities/${entityId}/controls/${control}/claims`, {
        value,
        unit: unit.trim() || undefined,
        note: note.trim() || undefined,
      })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the claim')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="rre-panel" onSubmit={submit} aria-label={`Add a claim for ${control}`}>
      <h3>
        Add a claim for <code>{control}</code>
      </h3>
      {evidenceExpectation ? (
        <p className="rre-note" data-testid="evidence-expectation">
          <strong>Evidence expected:</strong> {evidenceExpectation}
        </p>
      ) : null}
      <p className="rre-note">The claim enters review — it is not treated as approved evidence.</p>
      <div className="rre-field">
        <label htmlFor="claim-value">Value *</label>
        <input id="claim-value" value={value} onChange={(e) => setValue(e.target.value)} required />
      </div>
      <div className="rre-field">
        <label htmlFor="claim-unit">Unit</label>
        <input id="claim-unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
      </div>
      <div className="rre-field">
        <label htmlFor="claim-note">Note</label>
        <input id="claim-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error ? (
        <p className="rre-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="rre-actions">
        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Submit for review'}
        </button>
        <button type="button" className="rre-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
