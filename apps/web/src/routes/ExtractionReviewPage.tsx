import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client.js'
import type { ExtractionProposal, ExtractionRun } from '../api/types.js'

export function ExtractionReviewPage(): ReactElement {
  const { id = '', documentId = '' } = useParams()
  const [runs, setRuns] = useState<ExtractionRun[]>([])
  const [proposals, setProposals] = useState<ExtractionProposal[]>([])
  const [activeRun, setActiveRun] = useState<ExtractionRun | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})

  const load = useCallback(() => {
    let live = true
    setStatus('loading')
    api
      .get<{ runs: ExtractionRun[] }>(`/entities/${id}/documents/${documentId}/extractions`)
      .then(async (r) => {
        if (!live) return
        setRuns(r.runs)
        const latest = r.runs[0] ?? null
        setActiveRun(latest)
        if (latest) {
          const detail = await api.get<{ run: ExtractionRun; proposals: ExtractionProposal[] }>(
            `/extractions/${latest.id}`,
          )
          if (live) setProposals(detail.proposals)
        } else {
          setProposals([])
        }
        if (live) setStatus('ok')
      })
      .catch((e: unknown) => {
        if (!live) return
        setStatus(e instanceof ApiError && e.status === 404 ? 'error' : 'error')
      })
    return () => {
      live = false
    }
  }, [id, documentId])

  useEffect(() => load(), [load, version])

  async function runExtraction(): Promise<void> {
    setBusy('run')
    setError(null)
    try {
      await api.post(`/entities/${id}/documents/${documentId}/extractions`, {})
      setVersion((v) => v + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed')
    } finally {
      setBusy('')
    }
  }

  async function accept(proposalId: string): Promise<void> {
    setBusy(proposalId)
    setError(null)
    try {
      await api.post(`/extraction-proposals/${proposalId}/accept`, {})
      setVersion((v) => v + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept the proposal')
    } finally {
      setBusy('')
    }
  }

  async function reject(proposalId: string): Promise<void> {
    setBusy(proposalId)
    setError(null)
    try {
      await api.post(`/extraction-proposals/${proposalId}/reject`, {
        reason: reasons[proposalId]?.trim() || 'not correct',
      })
      setVersion((v) => v + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reject the proposal')
    } finally {
      setBusy('')
    }
  }

  if (status === 'loading') return <p>Loading extractions…</p>
  if (status === 'error') return <p className="rre-error">Could not load extractions.</p>

  return (
    <section>
      <h1>Extraction review</h1>
      <p>
        <Link to={`/w/entities/${id}/documents`}>← Back to documents</Link>
      </p>
      <p className="rre-note">
        These are <strong>extracted proposals</strong>, not verified facts. Accepting one creates a
        claim that still goes through review; every proposal keeps its source quote.
      </p>

      {error ? (
        <p className="rre-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="rre-actions">
        <button type="button" disabled={busy === 'run'} onClick={runExtraction}>
          {busy === 'run' ? 'Running…' : runs.length === 0 ? 'Run extraction' : 'Run again'}
        </button>
      </div>

      {activeRun ? (
        <p className="rre-note">
          Run {activeRun.id.slice(0, 12)}… · <code>{activeRun.modelId}</code> · {activeRun.status} ·{' '}
          {activeRun.proposalCount} proposal(s)
        </p>
      ) : null}

      {proposals.length === 0 ? (
        <p>{runs.length === 0 ? 'No extraction has been run yet.' : 'This run found nothing.'}</p>
      ) : (
        <ul className="rre-queue">
          {proposals.map((p) => (
            <li key={p.id} className="rre-queue-item">
              <div className="rre-queue-head">
                <code>{p.controlKey}</code> ·{' '}
                {p.confidence != null
                  ? `confidence ${Math.round(p.confidence * 100)}%`
                  : 'no score'}{' '}
                · {p.status}
              </div>
              <div className="rre-queue-value">
                <strong>{p.value}</strong>
                {p.unit ? ` ${p.unit}` : ''}
              </div>
              <blockquote className="rre-note">
                “{p.quote}”{p.page ? ` (page ${p.page})` : ''}
              </blockquote>
              {p.validation.map((v) => (
                <p
                  key={v.code}
                  className={v.level === 'error' ? 'rre-error' : 'rre-note'}
                  role={v.level === 'error' ? 'alert' : undefined}
                >
                  {v.level === 'error' ? '✗ ' : '⚠ '}
                  {v.message}
                </p>
              ))}
              {p.status === 'PENDING' ? (
                <>
                  <div className="rre-field">
                    <label htmlFor={`rej-${p.id}`}>Reason (if rejecting)</label>
                    <input
                      id={`rej-${p.id}`}
                      value={reasons[p.id] ?? ''}
                      onChange={(e) => setReasons((r) => ({ ...r, [p.id]: e.target.value }))}
                    />
                  </div>
                  <div className="rre-actions">
                    <button type="button" disabled={busy === p.id} onClick={() => accept(p.id)}>
                      Accept as a claim
                    </button>
                    <button
                      type="button"
                      className="rre-secondary"
                      disabled={busy === p.id}
                      onClick={() => reject(p.id)}
                    >
                      Reject
                    </button>
                  </div>
                </>
              ) : (
                <p className="rre-note">
                  {p.status === 'ACCEPTED'
                    ? `Accepted → claim ${p.acceptedClaimId?.slice(0, 12)}…`
                    : `Rejected${p.reason ? `: ${p.reason}` : ''}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
