import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { api, ApiError } from '../api/client.js'
import { getTenant } from '../workspace.js'
import type {
  DeletionRequestList,
  DeletionRequestRecord,
  ExecuteDeletionResponse,
  RequestDeletionResponse,
} from '../api/types.js'

function download(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function CountTable({ counts }: { counts: Record<string, number> }): ReactElement {
  const rows = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
  if (rows.length === 0) return <p>No stored records.</p>
  return (
    <table className="rre-table">
      <thead>
        <tr>
          <th>Table</th>
          <th>Rows</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([table, n]) => (
          <tr key={table}>
            <td>
              <code>{table}</code>
            </td>
            <td>{n}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function DeletionPage(): ReactElement {
  const tenant = getTenant()
  const [requests, setRequests] = useState<DeletionRequestRecord[]>([])
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [confirmRequest, setConfirmRequest] = useState('')
  const [pending, setPending] = useState<RequestDeletionResponse | null>(null)
  const [confirmExecute, setConfirmExecute] = useState('')
  const [done, setDone] = useState<ExecuteDeletionResponse | null>(null)

  const load = useCallback(() => {
    let live = true
    setStatus('loading')
    api
      .get<DeletionRequestList>('/deletion-requests')
      .then((r) => {
        if (!live) return
        setRequests(r.deletionRequests)
        setStatus('ok')
      })
      .catch(() => live && setStatus('error'))
    return () => {
      live = false
    }
  }, [])

  useEffect(() => load(), [load, version])

  async function exportBundle(): Promise<void> {
    setBusy('export')
    setError(null)
    try {
      const text = await api.getText('/export/tenant')
      download(
        `${tenant}-export-${new Date().toISOString().slice(0, 10)}.json`,
        text,
        'application/json',
      )
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Export failed.')
    } finally {
      setBusy('')
    }
  }

  async function requestDeletion(): Promise<void> {
    setBusy('request')
    setError(null)
    try {
      const res = await api.post<RequestDeletionResponse>('/deletion-requests', {
        confirmation: confirmRequest,
      })
      setPending(res)
      setConfirmRequest('')
      setVersion((v) => v + 1)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not record the request.')
    } finally {
      setBusy('')
    }
  }

  async function executeDeletion(): Promise<void> {
    if (!pending) return
    setBusy('execute')
    setError(null)
    try {
      const res = await api.post<ExecuteDeletionResponse>(
        `/deletion-requests/${pending.deletionRequestId}/execute`,
        { confirmation: confirmExecute },
      )
      setDone(res)
      setPending(null)
      setConfirmExecute('')
      setVersion((v) => v + 1)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Deletion failed.')
    } finally {
      setBusy('')
    }
  }

  return (
    <section>
      <h1>Data export &amp; deletion</h1>
      <p className="rre-note">
        Everything this workspace has stored — entities, claims, requests, documents metadata,
        snapshots, notifications, and the audit trail. Export it, or delete all of it.
      </p>

      {error ? <p className="rre-error">{error}</p> : null}

      <h2>Export a copy</h2>
      <p>
        A single JSON file with every record held for workspace <code>{tenant}</code>.
      </p>
      <button
        type="button"
        className="rre-secondary"
        disabled={busy === 'export'}
        onClick={exportBundle}
      >
        {busy === 'export' ? 'Preparing…' : 'Download all data'}
      </button>

      <h2 className="rre-danger-heading">Delete this workspace</h2>
      <p className="rre-note">
        This permanently removes every record and stored file. A completion receipt is kept — with
        no content — as proof the deletion happened. This cannot be undone.
      </p>

      {done ? (
        <div className="rre-panel" data-testid="deletion-done">
          <p>
            <strong>Deleted.</strong> {Object.values(done.purged).reduce((a, b) => a + b, 0)} rows
            and {done.objectsRemoved} stored file(s) were purged.
          </p>
        </div>
      ) : pending ? (
        <div className="rre-panel" data-testid="deletion-preview">
          <p>
            <strong>Ready to delete.</strong> This will purge:
          </p>
          <CountTable counts={pending.preview} />
          <label htmlFor="confirm-execute">
            Type <code>{tenant}</code> again to confirm permanent deletion
          </label>
          <input
            id="confirm-execute"
            value={confirmExecute}
            onChange={(e) => setConfirmExecute(e.target.value)}
            autoComplete="off"
          />
          <div className="rre-actions">
            <button
              type="button"
              className="rre-danger"
              disabled={busy === 'execute' || confirmExecute !== tenant}
              onClick={executeDeletion}
            >
              {busy === 'execute' ? 'Deleting…' : 'Permanently delete everything'}
            </button>
            <button
              type="button"
              className="rre-secondary"
              disabled={busy === 'execute'}
              onClick={() => {
                setPending(null)
                setConfirmExecute('')
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="rre-panel">
          <label htmlFor="confirm-request">
            Type the workspace id <code>{tenant}</code> to begin
          </label>
          <input
            id="confirm-request"
            value={confirmRequest}
            onChange={(e) => setConfirmRequest(e.target.value)}
            autoComplete="off"
          />
          <div className="rre-actions">
            <button
              type="button"
              className="rre-danger"
              disabled={busy === 'request' || confirmRequest !== tenant}
              onClick={requestDeletion}
            >
              {busy === 'request' ? 'Working…' : 'Request deletion'}
            </button>
          </div>
        </div>
      )}

      <h2>History</h2>
      {status === 'loading' ? (
        <p>Loading…</p>
      ) : status === 'error' ? (
        <p className="rre-error">Could not load deletion history.</p>
      ) : requests.length === 0 ? (
        <p>No deletion requests for this workspace.</p>
      ) : (
        <ul className="rre-queue">
          {requests.map((r) => (
            <li key={r.id} className="rre-queue-item">
              <div className="rre-queue-head">
                {new Date(r.requestedAt).toLocaleString()} · by {r.requestedBy}
              </div>
              <strong>{r.status}</strong>
              {r.status === 'COMPLETED' && r.purged ? (
                <div>
                  Purged {Object.values(r.purged).reduce((a, b) => a + b, 0)} rows
                  {r.completedAt ? ` on ${new Date(r.completedAt).toLocaleString()}` : ''}.
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
