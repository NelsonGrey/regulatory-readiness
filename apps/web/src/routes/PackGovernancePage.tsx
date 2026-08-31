import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { api, ApiError } from '../api/client.js'
import type { PackOverview, PackOverviewList } from '../api/types.js'

const STATUS_TONE: Record<string, string> = {
  active: 'ok',
  draft: 'warn',
  'in-review': 'warn',
  superseded: 'bad',
}

export function PackGovernancePage(): ReactElement {
  const [packs, setPacks] = useState<PackOverview[] | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'forbidden' | 'error'>('loading')
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    let live = true
    setStatus('loading')
    api
      .get<PackOverviewList>('/admin/packs')
      .then((r) => {
        if (!live) return
        setPacks(r.packs)
        setStatus('ok')
      })
      .catch((e: unknown) => {
        if (!live) return
        setStatus(e instanceof ApiError && e.status === 403 ? 'forbidden' : 'error')
      })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => load(), [load, version])

  async function act(key: string, path: string): Promise<void> {
    setBusy(key)
    setError(null)
    try {
      await api.post(path, {})
      setVersion((v) => v + 1)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.')
    } finally {
      setBusy('')
    }
  }

  if (status === 'loading') return <p>Loading pack governance…</p>
  if (status === 'forbidden')
    return <p className="rre-error">You are not a platform administrator.</p>
  if (status === 'error' || !packs)
    return <p className="rre-error">Could not load pack governance.</p>

  return (
    <section>
      <h1>Pack governance</h1>
      <p className="rre-note">
        Activation is recorded against a pack's computed checksum. It needs the pack to validate and
        two distinct reviewers on the current checksum. If the bundle changes after activation, the
        status falls back to <code>draft</code> until it is re-reviewed.
      </p>
      {error ? <p className="rre-error">{error}</p> : null}

      <table className="rre-table">
        <thead>
          <tr>
            <th>Pack</th>
            <th>Status</th>
            <th>Checksum</th>
            <th>Reviews</th>
            <th>Blockers</th>
            <th aria-label="actions" />
          </tr>
        </thead>
        <tbody>
          {packs.map((p) => (
            <tr key={p.packKey} data-testid={`pack-${p.packKey}`}>
              <td>
                <strong>{p.title ?? p.packKey}</strong>
                <div className="rre-note">
                  <code>{p.packKey}</code>
                </div>
              </td>
              <td>
                <span className={`rre-badge rre-badge-${STATUS_TONE[p.effectiveStatus] ?? 'warn'}`}>
                  {p.effectiveStatus}
                </span>
                {p.effectiveStatus !== p.onDiskStatus ? (
                  <div className="rre-note">on disk: {p.onDiskStatus}</div>
                ) : null}
                {p.driftedSinceActivation ? (
                  <div className="rre-error">bundle changed since activation — re-review</div>
                ) : null}
                {!p.valid ? <div className="rre-error">has validation errors</div> : null}
              </td>
              <td>
                <code>{p.computedChecksum.replace(/^sha256:/, '').slice(0, 12)}…</code>
              </td>
              <td>
                {p.distinctReviewers} / 2
                {p.reviews.length > 0 ? (
                  <div className="rre-note">{p.reviews.map((r) => r.reviewer).join(', ')}</div>
                ) : null}
              </td>
              <td>{p.blockers.length > 0 ? p.blockers.join('; ') : '—'}</td>
              <td>
                <div className="rre-actions">
                  <button
                    type="button"
                    className="rre-secondary"
                    disabled={busy === `rev-${p.packKey}`}
                    onClick={() => act(`rev-${p.packKey}`, `/admin/packs/${p.packKey}/reviews`)}
                  >
                    Add my review
                  </button>
                  <button
                    type="button"
                    disabled={!p.canActivate || busy === `act-${p.packKey}`}
                    onClick={() => act(`act-${p.packKey}`, `/admin/packs/${p.packKey}/activate`)}
                  >
                    Activate
                  </button>
                  {p.effectiveStatus === 'active' && !p.driftedSinceActivation ? (
                    <button
                      type="button"
                      className="rre-secondary"
                      disabled={busy === `wd-${p.packKey}`}
                      onClick={() => act(`wd-${p.packKey}`, `/admin/packs/${p.packKey}/withdraw`)}
                    >
                      Withdraw
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
