import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client.js'
import type { DocumentRecord, ReviewQueue } from '../api/types.js'

interface EvidenceDraft {
  documentId: string
  page: string
  quote: string
}

const emptyDraft: EvidenceDraft = { documentId: '', page: '', quote: '' }

export function ReviewQueuePage(): ReactElement {
  const { id = '' } = useParams()
  const [queue, setQueue] = useState<ReviewQueue | null>(null)
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading')
  const [version, setVersion] = useState(0)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, EvidenceDraft>>({})
  const [attached, setAttached] = useState<Record<string, number>>({})

  const load = useCallback(() => {
    let live = true
    setStatus('loading')
    Promise.all([
      api.get<ReviewQueue>(`/entities/${id}/review-queue`),
      api.get<{ documents: DocumentRecord[] }>(`/documents?entityId=${id}`),
    ])
      .then(([q, d]) => {
        if (!live) return
        setQueue(q)
        setDocuments(d.documents.filter((doc) => doc.status === 'AVAILABLE'))
        setStatus('ok')
      })
      .catch((e: unknown) => {
        if (!live) return
        setStatus(e instanceof ApiError && e.status === 404 ? 'notfound' : 'error')
      })
    return () => {
      live = false
    }
  }, [id])

  useEffect(() => load(), [load, version])

  async function decide(claimId: string, decision: 'APPROVED' | 'REJECTED'): Promise<void> {
    setErrors((e) => ({ ...e, [claimId]: '' }))
    try {
      await api.post(`/claims/${claimId}/decisions`, {
        decision,
        ...(decision === 'REJECTED' ? { reason: reasons[claimId]?.trim() || undefined } : {}),
      })
      setVersion((v) => v + 1)
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [claimId]: err instanceof Error ? err.message : 'Could not record the decision',
      }))
    }
  }

  async function attach(claimId: string): Promise<void> {
    const d = drafts[claimId] ?? emptyDraft
    if (!d.documentId) return
    setErrors((e) => ({ ...e, [claimId]: '' }))
    try {
      await api.post(`/claims/${claimId}/evidence`, {
        documentId: d.documentId,
        page: d.page ? Number(d.page) : undefined,
        quote: d.quote.trim() || undefined,
      })
      setAttached((a) => ({ ...a, [claimId]: (a[claimId] ?? 0) + 1 }))
      setDrafts((s) => ({ ...s, [claimId]: { ...emptyDraft } }))
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [claimId]: err instanceof Error ? err.message : 'Could not attach the evidence',
      }))
    }
  }

  if (status === 'loading') return <p>Loading the review queue…</p>
  if (status === 'notfound') return <p className="rre-error">Entity not found in this workspace.</p>
  if (status === 'error' || !queue)
    return <p className="rre-error">Could not load the review queue.</p>

  return (
    <section>
      <h1>Review queue</h1>
      <p>
        <Link to={`/w/entities/${id}/matrix`}>← Back to the matrix</Link>
      </p>
      <p className="rre-note">
        Attaching a supporting document is what moves an approved claim from “self-attested” to
        “evidenced”.
      </p>

      {queue.items.length === 0 ? (
        <p>Nothing is awaiting review.</p>
      ) : (
        <ul className="rre-queue">
          {queue.items.map((c) => {
            const d = drafts[c.id] ?? emptyDraft
            return (
              <li key={c.id} className="rre-queue-item">
                <div className="rre-queue-head">
                  <code>{c.controlKey}</code> · rev {c.revision} · {c.origin}
                </div>
                <div className="rre-queue-value">
                  <strong>{c.value}</strong>
                  {c.unit ? ` ${c.unit}` : ''} — asserted by {c.assertedBy}
                </div>

                <div className="rre-field">
                  <label htmlFor={`ev-doc-${c.id}`}>Attach evidence</label>
                  <select
                    id={`ev-doc-${c.id}`}
                    value={d.documentId}
                    onChange={(e) =>
                      setDrafts((s) => ({
                        ...s,
                        [c.id]: { ...d, documentId: e.target.value },
                      }))
                    }
                  >
                    <option value="">
                      {documents.length === 0 ? 'No available documents' : 'Choose a document…'}
                    </option>
                    {documents.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.filename}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rre-field">
                  <label htmlFor={`ev-page-${c.id}`}>Page (optional)</label>
                  <input
                    id={`ev-page-${c.id}`}
                    type="number"
                    min="1"
                    value={d.page}
                    onChange={(e) =>
                      setDrafts((s) => ({ ...s, [c.id]: { ...d, page: e.target.value } }))
                    }
                  />
                </div>
                <div className="rre-field">
                  <label htmlFor={`ev-quote-${c.id}`}>Quoted text (optional)</label>
                  <input
                    id={`ev-quote-${c.id}`}
                    value={d.quote}
                    onChange={(e) =>
                      setDrafts((s) => ({ ...s, [c.id]: { ...d, quote: e.target.value } }))
                    }
                  />
                </div>
                {attached[c.id] ? (
                  <p className="rre-note" role="status">
                    {attached[c.id]} document(s) attached to this claim.
                  </p>
                ) : null}

                <div className="rre-field">
                  <label htmlFor={`reason-${c.id}`}>Reason (required to reject)</label>
                  <input
                    id={`reason-${c.id}`}
                    value={reasons[c.id] ?? ''}
                    onChange={(e) => setReasons((r) => ({ ...r, [c.id]: e.target.value }))}
                  />
                </div>
                {errors[c.id] ? (
                  <p className="rre-error" role="alert">
                    {errors[c.id]}
                  </p>
                ) : null}
                <div className="rre-actions">
                  <button
                    type="button"
                    className="rre-secondary"
                    disabled={!d.documentId}
                    onClick={() => attach(c.id)}
                  >
                    Attach
                  </button>
                  <button type="button" onClick={() => decide(c.id, 'APPROVED')}>
                    Approve
                  </button>
                  <button
                    type="button"
                    className="rre-secondary"
                    onClick={() => decide(c.id, 'REJECTED')}
                  >
                    Reject
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
