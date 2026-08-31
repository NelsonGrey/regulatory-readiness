import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client.js'
import type { RequestDetail } from '../api/types.js'

const AVAILABILITY_LABEL: Record<string, string> = {
  VALUE_SUPPLIED: 'Value supplied',
  UNAVAILABLE: 'Unavailable',
  UNKNOWN: 'Unknown',
  NOT_APPLICABLE: 'Not applicable',
  NEEDS_CLARIFICATION: 'Needs clarification',
}

export function RequestDetailPage(): ReactElement {
  const { id = '', requestId = '' } = useParams()
  const [detail, setDetail] = useState<RequestDetail | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading')
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    let live = true
    setStatus('loading')
    api
      .get<RequestDetail>(`/requests/${requestId}`)
      .then((d) => {
        if (!live) return
        setDetail(d)
        setStatus('ok')
      })
      .catch((e: unknown) => {
        if (!live) return
        setStatus(e instanceof ApiError && e.status === 404 ? 'notfound' : 'error')
      })
    return () => {
      live = false
    }
  }, [requestId])

  useEffect(() => load(), [load, version])

  async function act(kind: 'send' | 'revoke'): Promise<void> {
    setBusy(kind)
    setError(null)
    try {
      await api.post(`/requests/${requestId}/${kind}`, {})
      setVersion((v) => v + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${kind} the request`)
    } finally {
      setBusy('')
    }
  }

  async function accept(submissionId: string, itemId: string): Promise<void> {
    setBusy(itemId)
    setError(null)
    try {
      await api.post(`/submissions/${submissionId}/items/${itemId}/accept`, {})
      setVersion((v) => v + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept this response')
    } finally {
      setBusy('')
    }
  }

  if (status === 'loading') return <p>Loading the request…</p>
  if (status === 'notfound')
    return <p className="rre-error">Request not found in this workspace.</p>
  if (status === 'error' || !detail) return <p className="rre-error">Could not load the request.</p>

  const { request, items, grants, submissions } = detail
  const activeGrant = grants.find((g) => !g.revokedAt)

  return (
    <section>
      <h1>Request {request.id.slice(0, 12)}…</h1>
      <p>
        <Link to={`/w/entities/${id}/requests`}>← Back to requests</Link>
      </p>

      <dl className="rre-context">
        <div>
          <dt>Status</dt>
          <dd data-status={request.status}>{request.status}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>
            {new Date(request.createdAt).toLocaleString()} by {request.createdBy}
          </dd>
        </div>
        <div>
          <dt>Link</dt>
          <dd>
            {activeGrant
              ? `${activeGrant.tokenPrefix}… · expires ${new Date(
                  activeGrant.expiresAt,
                ).toLocaleDateString()} · used ${activeGrant.uses}×`
              : 'revoked'}
          </dd>
        </div>
        {detail.draftUpdatedAt ? (
          <div>
            <dt>Draft</dt>
            <dd>in progress · saved {new Date(detail.draftUpdatedAt).toLocaleString()}</dd>
          </div>
        ) : null}
      </dl>

      {request.message ? <blockquote className="rre-note">{request.message}</blockquote> : null}

      {error ? (
        <p className="rre-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="rre-actions">
        {request.status === 'DRAFT' ? (
          <button type="button" disabled={busy === 'send'} onClick={() => act('send')}>
            {busy === 'send' ? 'Marking…' : 'Mark as sent'}
          </button>
        ) : null}
        {activeGrant ? (
          <button
            type="button"
            className="rre-secondary"
            disabled={busy === 'revoke'}
            onClick={() => act('revoke')}
          >
            {busy === 'revoke' ? 'Revoking…' : 'Revoke link'}
          </button>
        ) : null}
      </div>

      <h2>Requested controls</h2>
      <ul className="rre-list">
        {items.map((i) => (
          <li key={i.id}>
            <code>{i.controlKey}</code>
            {i.requiredInRequest ? <span className="rre-badge"> required</span> : null}
          </li>
        ))}
      </ul>

      <h2>Submissions</h2>
      {submissions.length === 0 ? (
        <p>Nothing submitted yet.</p>
      ) : (
        submissions.map((s) => (
          <div key={s.id} className="rre-panel">
            <h3>
              Version {s.version} · {new Date(s.submittedAt).toLocaleString()}
            </h3>
            <table className="rre-table">
              <thead>
                <tr>
                  <th>Control</th>
                  <th>Availability</th>
                  <th>Value</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {s.responses.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <code>{r.controlKey}</code>
                    </td>
                    <td>{AVAILABILITY_LABEL[r.availabilityState] ?? r.availabilityState}</td>
                    <td>{r.value ? `${r.value}${r.unit ? ` ${r.unit}` : ''}` : '—'}</td>
                    <td>
                      {r.availabilityState === 'VALUE_SUPPLIED' && r.value ? (
                        <button
                          type="button"
                          className="rre-secondary"
                          disabled={busy === r.id}
                          onClick={() => accept(s.id, r.id)}
                        >
                          {busy === r.id ? 'Accepting…' : 'Accept into review'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </section>
  )
}
