import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react'
import { useParams } from 'react-router-dom'
import { ApiError } from '../api/client.js'
import { contributorApi } from '../api/contributor-client.js'
import type {
  AvailabilityState,
  ContributorDraft,
  ContributorReceipt,
  ContributorView,
} from '../api/types.js'

const STATES: { value: AvailabilityState; label: string }[] = [
  { value: 'VALUE_SUPPLIED', label: 'I can provide a value' },
  { value: 'UNAVAILABLE', label: 'We do not have this' },
  { value: 'UNKNOWN', label: 'I do not know' },
  { value: 'NOT_APPLICABLE', label: 'Not applicable to us' },
  { value: 'NEEDS_CLARIFICATION', label: 'I need clarification' },
]

interface Answer {
  availabilityState: AvailabilityState
  value: string
  unit: string
  methodNote: string
  comment: string
}

const EMPTY: Answer = {
  availabilityState: 'VALUE_SUPPLIED',
  value: '',
  unit: '',
  methodNote: '',
  comment: '',
}

/** Rebuild the answer map from a saved draft, falling back to EMPTY per item. */
function answersFromDraft(
  itemIds: string[],
  draft: ContributorDraft | null,
): Record<string, Answer> {
  const byId = new Map((draft?.items ?? []).map((i) => [i.requestItemId, i]))
  return Object.fromEntries(
    itemIds.map((id) => {
      const d = byId.get(id)
      return [
        id,
        d
          ? {
              availabilityState: d.availabilityState ?? 'VALUE_SUPPLIED',
              value: d.value ?? '',
              unit: d.unit ?? '',
              methodNote: d.methodNote ?? '',
              comment: d.comment ?? '',
            }
          : { ...EMPTY },
      ]
    }),
  )
}

export function ContributorPortalPage(): ReactElement {
  const { token = '' } = useParams()
  const [view, setView] = useState<ContributorView | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'invalid' | 'error'>('loading')
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [submitter, setSubmitter] = useState('')
  const [busy, setBusy] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<ContributorReceipt | null>(null)

  const load = useCallback(() => {
    let live = true
    setStatus('loading')
    contributorApi
      .get<ContributorView>(`/requests/${token}`)
      .then((v) => {
        if (!live) return
        setView(v)
        setAnswers(
          answersFromDraft(
            v.items.map((i) => i.requestItemId),
            v.draft,
          ),
        )
        if (v.draft?.submitterIdentity) setSubmitter(v.draft.submitterIdentity)
        setStatus('ok')
      })
      .catch((e: unknown) => {
        if (!live) return
        setStatus(e instanceof ApiError && e.status === 404 ? 'invalid' : 'error')
      })
    return () => {
      live = false
    }
  }, [token])

  useEffect(() => load(), [load])

  function patch(itemId: string, part: Partial<Answer>): void {
    setAnswers((a) => ({ ...a, [itemId]: { ...a[itemId], ...part } as Answer }))
  }

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!view) return
    setBusy(true)
    setFormError(null)
    try {
      const res = await contributorApi.post<ContributorReceipt>(`/requests/${token}/submit`, {
        submitterIdentity: submitter.trim() || undefined,
        items: view.items.map((i) => {
          const a = answers[i.requestItemId] ?? EMPTY
          return {
            requestItemId: i.requestItemId,
            availabilityState: a.availabilityState,
            value: a.value.trim() || undefined,
            unit: a.unit.trim() || undefined,
            methodNote: a.methodNote.trim() || undefined,
            comment: a.comment.trim() || undefined,
          }
        }),
      })
      setReceipt(res)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not send your answers')
    } finally {
      setBusy(false)
    }
  }

  async function saveDraft(): Promise<void> {
    if (!view) return
    setSavingDraft(true)
    setFormError(null)
    try {
      const res = await contributorApi.put<{ savedAt: string }>(`/requests/${token}/draft`, {
        submitterIdentity: submitter.trim() || undefined,
        items: view.items.map((i) => {
          const a = answers[i.requestItemId] ?? EMPTY
          return {
            requestItemId: i.requestItemId,
            availabilityState: a.availabilityState,
            value: a.value.trim() || undefined,
            unit: a.unit.trim() || undefined,
            methodNote: a.methodNote.trim() || undefined,
            comment: a.comment.trim() || undefined,
          }
        }),
      })
      setSavedAt(res.savedAt)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save your progress')
    } finally {
      setSavingDraft(false)
    }
  }

  if (status === 'loading') return <main className="rre-portal">Loading…</main>
  if (status === 'invalid')
    return (
      <main className="rre-portal">
        <h1>This link cannot be opened</h1>
        <p>
          It may have expired, been revoked, or never been valid. Ask your contact for a new one.
        </p>
      </main>
    )
  if (status === 'error' || !view)
    return (
      <main className="rre-portal">
        <p className="rre-error">Something went wrong loading this request.</p>
      </main>
    )

  if (receipt)
    return (
      <main className="rre-portal">
        <h1>Thank you — your answers were received</h1>
        <p className="rre-token">
          Receipt <code>{receipt.receiptId}</code>
        </p>
        <p>
          Submitted {new Date(receipt.submittedAt).toLocaleString()} · {receipt.itemCount} item(s) ·
          version {receipt.version}.
        </p>
        <p className="rre-note">{receipt.note}</p>
      </main>
    )

  return (
    <main className="rre-portal">
      <h1>Information request from {view.requestingOrganization}</h1>
      <p>
        About: <strong>{view.entityName}</strong>
        {view.dueAt ? ` · requested by ${new Date(view.dueAt).toLocaleDateString()}` : ''}
      </p>
      <p className="rre-note">
        Your answers go to the requesting organization for review. Nothing here is treated as
        approved or official. You do not need an account.
      </p>

      <form onSubmit={submit}>
        {view.items.map((item) => {
          const a = answers[item.requestItemId] ?? EMPTY
          return (
            <fieldset key={item.requestItemId} className="rre-panel">
              <legend>
                {item.title}
                {item.required ? ' *' : ''}
              </legend>
              <p className="rre-note">
                <code>{item.controlKey}</code>
                {item.instructions ? ` — ${item.instructions}` : ''}
              </p>
              <div className="rre-field">
                <label htmlFor={`state-${item.requestItemId}`}>Response</label>
                <select
                  id={`state-${item.requestItemId}`}
                  value={a.availabilityState}
                  onChange={(e) =>
                    patch(item.requestItemId, {
                      availabilityState: e.target.value as AvailabilityState,
                    })
                  }
                >
                  {STATES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              {a.availabilityState === 'VALUE_SUPPLIED' ? (
                <>
                  <div className="rre-field">
                    <label htmlFor={`value-${item.requestItemId}`}>Value</label>
                    <input
                      id={`value-${item.requestItemId}`}
                      value={a.value}
                      onChange={(e) => patch(item.requestItemId, { value: e.target.value })}
                    />
                  </div>
                  <div className="rre-field">
                    <label htmlFor={`unit-${item.requestItemId}`}>Unit</label>
                    <input
                      id={`unit-${item.requestItemId}`}
                      value={a.unit}
                      onChange={(e) => patch(item.requestItemId, { unit: e.target.value })}
                    />
                  </div>
                  <div className="rre-field">
                    <label htmlFor={`method-${item.requestItemId}`}>How was this determined?</label>
                    <input
                      id={`method-${item.requestItemId}`}
                      value={a.methodNote}
                      onChange={(e) => patch(item.requestItemId, { methodNote: e.target.value })}
                    />
                  </div>
                </>
              ) : null}
              <div className="rre-field">
                <label htmlFor={`comment-${item.requestItemId}`}>Comment</label>
                <input
                  id={`comment-${item.requestItemId}`}
                  value={a.comment}
                  onChange={(e) => patch(item.requestItemId, { comment: e.target.value })}
                />
              </div>
            </fieldset>
          )
        })}

        <div className="rre-field">
          <label htmlFor="submitter">Your name or email (optional)</label>
          <input id="submitter" value={submitter} onChange={(e) => setSubmitter(e.target.value)} />
        </div>

        {formError ? (
          <p className="rre-error" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="rre-actions">
          <button type="submit" disabled={busy || savingDraft}>
            {busy ? 'Sending…' : 'Send answers'}
          </button>
          <button
            type="button"
            className="rre-secondary"
            onClick={saveDraft}
            disabled={busy || savingDraft}
          >
            {savingDraft ? 'Saving…' : 'Save progress'}
          </button>
        </div>
        {savedAt ? (
          <p className="rre-note" role="status">
            Progress saved {new Date(savedAt).toLocaleTimeString()}. You can close this page and
            come back to the same link.
          </p>
        ) : null}
      </form>
    </main>
  )
}
