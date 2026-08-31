import { useEffect, useState, type ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import type { PackSummary } from '../api/types.js'

export function PacksPage(): ReactElement {
  const [packs, setPacks] = useState<PackSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    api
      .get<{ packs: PackSummary[] }>('/packs')
      .then((r) => live && setPacks(r.packs))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : 'Failed to load'))
    return () => {
      live = false
    }
  }, [])

  if (error) return <p className="rre-error">Could not load control packs: {error}</p>
  if (!packs) return <p>Loading control packs…</p>

  return (
    <section>
      <h1>Control packs</h1>
      <p>
        <Link to="/w/entities/new">Create a regulated entity →</Link>
      </p>
      {packs.length === 0 ? (
        <p>No control packs are installed.</p>
      ) : (
        <table className="rre-table">
          <thead>
            <tr>
              <th>Pack</th>
              <th>Title</th>
              <th>Jurisdiction</th>
              <th>Snapshot</th>
              <th>Status</th>
              <th>Valid</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {packs.map((p) => (
              <tr key={p.packKey}>
                <td>
                  <code>{p.packKey}</code>
                </td>
                <td>{p.title ?? '—'}</td>
                <td>{p.jurisdiction ?? '—'}</td>
                <td>{p.snapshotKey ?? '—'}</td>
                <td>{p.status ?? '—'}</td>
                <td>{p.valid ? 'yes' : 'no'}</td>
                <td>
                  <Link to={`/w/packs/${p.packKey}/impact`}>Snapshot impact →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
