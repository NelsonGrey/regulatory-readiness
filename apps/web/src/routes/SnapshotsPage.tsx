import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client.js'
import type { CreateSnapshotResponse, SnapshotSummary } from '../api/types.js'

const STATUS_LABEL: Record<string, string> = {
  BLOCKED: 'Blocked',
  REVIEW_NEEDED: 'Review needed',
  EVIDENCE_READY: 'Evidence ready',
  OUTDATED_SNAPSHOT: 'Outdated snapshot',
}

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

export function SnapshotsPage(): ReactElement {
  const { id = '' } = useParams()
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([])
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading')
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    let live = true
    setStatus('loading')
    api
      .get<{ snapshots: SnapshotSummary[] }>(`/entities/${id}/readiness-snapshots`)
      .then((r) => {
        if (!live) return
        setSnapshots(r.snapshots)
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

  async function create(): Promise<void> {
    setBusy('create')
    setError(null)
    try {
      await api.post<CreateSnapshotResponse>(`/entities/${id}/readiness-snapshots`, {})
      setVersion((v) => v + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the snapshot')
    } finally {
      setBusy('')
    }
  }

  async function exportFile(snapshotId: string, kind: 'json' | 'csv'): Promise<void> {
    setBusy(`${snapshotId}:${kind}`)
    setError(null)
    try {
      const text = await api.getText(`/readiness-snapshots/${snapshotId}/export.${kind}`)
      download(
        `readiness-${snapshotId}.${kind}`,
        text,
        kind === 'json' ? 'application/json' : 'text/csv',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export the snapshot')
    } finally {
      setBusy('')
    }
  }

  if (status === 'loading') return <p>Loading snapshots…</p>
  if (status === 'notfound') return <p className="rre-error">Entity not found in this workspace.</p>
  if (status === 'error') return <p className="rre-error">Could not load snapshots.</p>

  return (
    <section>
      <h1>Readiness snapshots</h1>
      <p>
        <Link to={`/w/entities/${id}/matrix`}>← Back to the matrix</Link>
      </p>
      <p className="rre-note">
        A snapshot freezes the current readiness of every control against this entity's control
        snapshot. Later approvals never change a snapshot already taken. Exports are generated only
        from a snapshot — never from live data.
      </p>

      {error ? (
        <p className="rre-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="rre-actions">
        <button type="button" disabled={busy === 'create'} onClick={create}>
          {busy === 'create' ? 'Freezing…' : 'Create readiness snapshot'}
        </button>
      </div>

      {snapshots.length === 0 ? (
        <p>No snapshots yet.</p>
      ) : (
        <table className="rre-table">
          <thead>
            <tr>
              <th>Taken</th>
              <th>Status</th>
              <th>Control snapshot</th>
              <th>Content hash</th>
              <th>Export</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((s) => (
              <tr key={s.id}>
                <td>
                  {new Date(s.createdAt).toLocaleString()} by {s.createdBy}
                </td>
                <td data-status={s.entityStatus}>
                  {STATUS_LABEL[s.entityStatus] ?? s.entityStatus}
                </td>
                <td>{s.snapshotKey}</td>
                <td>
                  <code>{s.contentHash.slice(0, 23)}…</code>
                </td>
                <td>
                  <div className="rre-actions">
                    <button
                      type="button"
                      className="rre-secondary"
                      disabled={busy === `${s.id}:json`}
                      onClick={() => exportFile(s.id, 'json')}
                    >
                      JSON
                    </button>
                    <button
                      type="button"
                      className="rre-secondary"
                      disabled={busy === `${s.id}:csv`}
                      onClick={() => exportFile(s.id, 'csv')}
                    >
                      CSV
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
