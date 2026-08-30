import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client.js'
import type {
  CreateRequestResponse,
  EntityMatrix,
  EvidenceRequest,
  MatrixRow,
} from '../api/types.js'

function isRequestable(row: MatrixRow): boolean {
  // Anything the pack expects for this entity — not the excluded / duplicate rows.
  return (
    row.applicability !== 'NOT_APPLICABLE_TO_CLASSIFICATION' &&
    row.applicability !== 'DUPLICATE_SOURCE_FIELD'
  )
}

export function RequestsPage(): ReactElement {
  const { id = '' } = useParams()
  const [matrix, setMatrix] = useState<EntityMatrix | null>(null)
  const [requests, setRequests] = useState<EvidenceRequest[]>([])
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading')
  const [version, setVersion] = useState(0)

  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [message, setMessage] = useState('')
  const [expiresInDays, setExpiresInDays] = useState('14')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [minted, setMinted] = useState<CreateRequestResponse | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(() => {
    let live = true
    setStatus('loading')
    Promise.all([
      api.get<EntityMatrix>(`/entities/${id}/matrix`),
      api.get<{ requests: EvidenceRequest[] }>(`/entities/${id}/requests`),
    ])
      .then(([m, r]) => {
        if (!live) return
        setMatrix(m)
        setRequests(r.requests)
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

  const rows = useMemo(() => (matrix ? matrix.rows.filter(isRequestable) : []), [matrix])
  const chosen = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected])

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setBusy(true)
    setFormError(null)
    setMinted(null)
    setCopied(false)
    try {
      const days = Number(expiresInDays)
      const res = await api.post<CreateRequestResponse>(`/entities/${id}/requests`, {
        controlKeys: chosen,
        message: message.trim() || undefined,
        expiresInDays: Number.isFinite(days) && days > 0 ? days : undefined,
      })
      setMinted(res)
      setSelected({})
      setMessage('')
      setVersion((v) => v + 1)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create the request')
    } finally {
      setBusy(false)
    }
  }

  if (status === 'loading') return <p>Loading requests…</p>
  if (status === 'notfound') return <p className="rre-error">Entity not found in this workspace.</p>
  if (status === 'error' || !matrix) return <p className="rre-error">Could not load requests.</p>

  const contributorUrl = minted ? `${window.location.origin}/contribute/${minted.token}` : ''

  return (
    <section>
      <h1>Evidence requests — {matrix.entity.name}</h1>
      <p>
        <Link to={`/w/entities/${id}/matrix`}>← Back to the matrix</Link>
      </p>
      <p className="rre-note">
        A request is a scoped link for someone without an account — a supplier or a colleague. They
        see only the controls you pick. What they send back enters review; it is not approved
        evidence.
      </p>

      {minted ? (
        <div className="rre-panel" role="status">
          <h3>Share this link once</h3>
          <p className="rre-note">
            This is the only time the link is shown. Anyone with it can answer the request until it
            expires ({new Date(minted.expiresAt).toLocaleDateString()}) or you revoke it.
          </p>
          <p className="rre-token">
            <code>{contributorUrl}</code>
          </p>
          <div className="rre-actions">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(contributorUrl)
                setCopied(true)
              }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <Link className="rre-secondary" to={`/w/entities/${id}/requests/${minted.request.id}`}>
              Open request
            </Link>
          </div>
        </div>
      ) : null}

      <form className="rre-panel" onSubmit={submit} aria-label="New evidence request">
        <h3>New request</h3>
        <fieldset className="rre-checks">
          <legend>Controls to ask about</legend>
          {rows.map((r) => (
            <label key={r.control} className="rre-check">
              <input
                type="checkbox"
                checked={!!selected[r.control]}
                onChange={(e) => setSelected((s) => ({ ...s, [r.control]: e.target.checked }))}
              />
              <code>{r.control}</code> <span>{r.title}</span>
            </label>
          ))}
        </fieldset>
        <div className="rre-field">
          <label htmlFor="req-message">Message to the recipient</label>
          <input
            id="req-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Optional — context for whoever answers"
          />
        </div>
        <div className="rre-field">
          <label htmlFor="req-expiry">Link expires in (days)</label>
          <input
            id="req-expiry"
            type="number"
            min="1"
            max="365"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
          />
        </div>
        {formError ? (
          <p className="rre-error" role="alert">
            {formError}
          </p>
        ) : null}
        <div className="rre-actions">
          <button type="submit" disabled={busy || chosen.length === 0}>
            {busy ? 'Creating…' : `Create request (${chosen.length})`}
          </button>
        </div>
      </form>

      <h2>Existing requests</h2>
      {requests.length === 0 ? (
        <p>No requests yet.</p>
      ) : (
        <table className="rre-table">
          <thead>
            <tr>
              <th>Request</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td>
                  <code>{r.id.slice(0, 12)}…</code>
                </td>
                <td>{r.status}</td>
                <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                <td>
                  <Link to={`/w/entities/${id}/requests/${r.id}`}>Open →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
