import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client.js'
import type { SnapshotImpactReport } from '../api/types.js'

export function PackImpactPage(): ReactElement {
  const { packKey = '' } = useParams()
  const [report, setReport] = useState<SnapshotImpactReport | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading')
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    let live = true
    setStatus('loading')
    api
      .get<SnapshotImpactReport>(`/packs/${packKey}/impact`)
      .then((r) => {
        if (!live) return
        setReport(r)
        setStatus('ok')
      })
      .catch((e: unknown) => {
        if (!live) return
        setStatus(e instanceof ApiError && e.status === 404 ? 'notfound' : 'error')
      })
    return () => {
      live = false
    }
  }, [packKey])

  useEffect(() => load(), [load, version])

  async function adopt(entityId: string): Promise<void> {
    setBusy(entityId)
    setError(null)
    try {
      await api.post(`/entities/${entityId}/re-evaluate`, {})
      setVersion((v) => v + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not re-evaluate the entity')
    } finally {
      setBusy('')
    }
  }

  if (status === 'loading') return <p>Loading impact…</p>
  if (status === 'notfound') return <p className="rre-error">No such control pack.</p>
  if (status === 'error' || !report)
    return <p className="rre-error">Could not load the impact report.</p>

  return (
    <section>
      <h1>Snapshot impact — {report.packKey}</h1>
      <p>
        <Link to="/">← Back to control packs</Link>
      </p>
      <p className="rre-note">
        Current control snapshot: <code>{report.currentSnapshotKey}</code>. {report.upToDate} entit
        {report.upToDate === 1 ? 'y is' : 'ies are'} already on it. Adopting re-evaluates an entity
        against the current snapshot; claims and evidence are kept.
      </p>

      {error ? (
        <p className="rre-error" role="alert">
          {error}
        </p>
      ) : null}

      {report.impacted.length === 0 ? (
        <p>Every entity on this pack is on the current snapshot.</p>
      ) : (
        <table className="rre-table">
          <thead>
            <tr>
              <th>Entity</th>
              <th>On snapshot</th>
              <th>Added</th>
              <th>Removed</th>
              <th>Orphaned claims</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {report.impacted.map((e) => (
              <tr key={e.entityId}>
                <td>
                  <Link to={`/w/entities/${e.entityId}/matrix`}>{e.name}</Link> · v
                  {e.evaluationVersion}
                </td>
                <td>
                  <code>{e.snapshotKey}</code>
                </td>
                <td>
                  {e.addedControls.length}
                  {e.addedControls.length > 0 ? (
                    <div className="rre-badge">{e.addedControls.join(', ')}</div>
                  ) : null}
                </td>
                <td>
                  {e.removedControls.length}
                  {e.removedControls.length > 0 ? (
                    <div className="rre-badge">{e.removedControls.join(', ')}</div>
                  ) : null}
                </td>
                <td className={e.orphanedClaims > 0 ? 'rre-error' : undefined}>
                  {e.orphanedClaims}
                </td>
                <td>
                  <button
                    type="button"
                    disabled={busy === e.entityId}
                    onClick={() => adopt(e.entityId)}
                  >
                    {busy === e.entityId ? 'Adopting…' : 'Adopt'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
