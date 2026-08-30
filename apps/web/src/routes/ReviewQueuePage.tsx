import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client.js'
import type { ReviewQueue } from '../api/types.js'

export function ReviewQueuePage(): ReactElement {
  const { id = '' } = useParams()
  const [queue, setQueue] = useState<ReviewQueue | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading')
  const [version, setVersion] = useState(0)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const load = useCallback(() => {
    let live = true
    setStatus('loading')
    api
      .get<ReviewQueue>(`/entities/${id}/review-queue`)
      .then((q) => {
        if (!live) return
        setQueue(q)
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

      {queue.items.length === 0 ? (
        <p>Nothing is awaiting review.</p>
      ) : (
        <ul className="rre-queue">
          {queue.items.map((c) => (
            <li key={c.id} className="rre-queue-item">
              <div className="rre-queue-head">
                <code>{c.controlKey}</code> · rev {c.revision} · {c.origin}
              </div>
              <div className="rre-queue-value">
                <strong>{c.value}</strong>
                {c.unit ? ` ${c.unit}` : ''} — asserted by {c.assertedBy}
              </div>
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
          ))}
        </ul>
      )}
    </section>
  )
}
