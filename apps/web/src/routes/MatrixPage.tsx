import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApplicabilityChip, ReadinessChip } from '@rre/ui'
import { api, ApiError } from '../api/client.js'
import type { EntityMatrix, MatrixRow, ReEvaluateResponse } from '../api/types.js'
import { AddClaimForm } from '../components/AddClaimForm.js'
import { OverrideForm } from '../components/OverrideForm.js'

const ENTITY_STATUS_LABEL: Record<string, string> = {
  BLOCKED: 'Blocked — required evidence is missing, conflicting, or stale',
  REVIEW_NEEDED: 'Review needed — proposals await an approver',
  EVIDENCE_READY: 'Evidence ready for this snapshot',
  OUTDATED_SNAPSHOT: 'A newer control snapshot is available',
}

const READINESS_ORDER = [
  'EVIDENCED',
  'SELF_ATTESTED',
  'PENDING_REVIEW',
  'MISSING',
  'CONFLICTING',
  'STALE',
  'CONDITIONAL',
  'NOT_YET_REQUIRED',
  'NOT_APPLICABLE',
] as const

export function MatrixPage(): ReactElement {
  const { id = '' } = useParams()
  const [matrix, setMatrix] = useState<EntityMatrix | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading')
  const [readinessFilter, setReadinessFilter] = useState('')
  const [activeControl, setActiveControl] = useState<string | null>(null)
  const [overrideControl, setOverrideControl] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [reEvalBusy, setReEvalBusy] = useState(false)
  const [reEval, setReEval] = useState<ReEvaluateResponse | null>(null)

  const load = useCallback(() => {
    let live = true
    setStatus('loading')
    api
      .get<EntityMatrix>(`/entities/${id}/matrix`)
      .then((m) => {
        if (!live) return
        setMatrix(m)
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

  async function reevaluate(): Promise<void> {
    setReEvalBusy(true)
    try {
      const res = await api.post<ReEvaluateResponse>(`/entities/${id}/re-evaluate`, {})
      setReEval(res)
      setVersion((v) => v + 1)
    } catch {
      /* surfaced via the matrix error state on the refetch, if any */
    } finally {
      setReEvalBusy(false)
    }
  }

  const rows = useMemo<MatrixRow[]>(
    () =>
      matrix ? matrix.rows.filter((r) => !readinessFilter || r.readiness === readinessFilter) : [],
    [matrix, readinessFilter],
  )

  if (status === 'loading') return <p>Loading the control matrix…</p>
  if (status === 'notfound') return <p className="rre-error">Entity not found in this workspace.</p>
  if (status === 'error' || !matrix) return <p className="rre-error">Could not load the matrix.</p>

  return (
    <section>
      <h1>{matrix.entity.name}</h1>

      <p className="rre-status" data-status={matrix.entityStatus}>
        {ENTITY_STATUS_LABEL[matrix.entityStatus] ?? matrix.entityStatus}. This is a preparation
        status, not certification or authority approval.
      </p>

      <dl className="rre-context">
        <div>
          <dt>Pack</dt>
          <dd>
            <code>{matrix.entity.packKey}</code>
          </dd>
        </div>
        <div>
          <dt>Snapshot</dt>
          <dd>{matrix.evaluation.snapshotKey}</dd>
        </div>
        <div>
          <dt>Evaluation</dt>
          <dd>
            v{matrix.evaluation.version} · <code>{matrix.evaluation.hash.slice(0, 19)}…</code>
          </dd>
        </div>
        <div>
          <dt>Review</dt>
          <dd>
            <Link to={`/w/entities/${id}/review`}>Review queue →</Link>
          </dd>
        </div>
        <div>
          <dt>Requests</dt>
          <dd>
            <Link to={`/w/entities/${id}/requests`}>Evidence requests →</Link>
          </dd>
        </div>
        <div>
          <dt>Snapshots</dt>
          <dd>
            <Link to={`/w/entities/${id}/snapshots`}>Snapshots &amp; export →</Link>
          </dd>
        </div>
        <div>
          <dt>Documents</dt>
          <dd>
            <Link to={`/w/entities/${id}/documents`}>Documents →</Link>
          </dd>
        </div>
      </dl>

      <div className="rre-actions">
        <button type="button" className="rre-secondary" disabled={reEvalBusy} onClick={reevaluate}>
          {reEvalBusy ? 'Re-evaluating…' : 'Re-evaluate applicability'}
        </button>
      </div>

      {reEval ? (
        <div className="rre-panel" role="status">
          <h3>Re-evaluated to v{reEval.version}</h3>
          {reEval.diff.added.length === 0 &&
          reEval.diff.removed.length === 0 &&
          reEval.diff.applicabilityChanged.length === 0 ? (
            <p className="rre-note">Nothing changed — applicability is the same.</p>
          ) : (
            <>
              <p className="rre-note">
                {reEval.diff.added.length} added · {reEval.diff.removed.length} removed ·{' '}
                {reEval.diff.applicabilityChanged.length} applicability change(s). Claims and
                evidence are unchanged.
              </p>
              {reEval.diff.applicabilityChanged.length > 0 ? (
                <ul className="rre-list">
                  {reEval.diff.applicabilityChanged.map((c) => (
                    <li key={c.control}>
                      <code>{c.control}</code>: {c.from} → {c.to}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <p className="rre-denominator">
        {matrix.summary.requiredNow} of {matrix.summary.total} controls are required by this
        snapshot. Excluded controls carry a recorded reason. No compliance score.
      </p>

      <ul className="rre-summary" aria-label="controls by readiness">
        {READINESS_ORDER.filter((s) => (matrix.readinessCounts[s] ?? 0) > 0).map((s) => (
          <li key={s}>
            <button
              type="button"
              className={readinessFilter === s ? 'is-active' : ''}
              onClick={() => setReadinessFilter(readinessFilter === s ? '' : s)}
            >
              <ReadinessChip state={s} /> <span>{matrix.readinessCounts[s]}</span>
            </button>
          </li>
        ))}
      </ul>

      <table className="rre-table">
        <thead>
          <tr>
            <th>Control</th>
            <th>Title</th>
            <th>Applicability</th>
            <th>Readiness</th>
            <th>Approved value</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.control}>
              <td>
                <code>{r.control}</code>
              </td>
              <td>{r.title}</td>
              <td>
                <ApplicabilityChip result={r.applicability} />
                {r.originalApplicability ? (
                  <div className="rre-badge">
                    overridden from {r.originalApplicability}
                    {r.overrideRationale ? ` — ${r.overrideRationale}` : ''}
                  </div>
                ) : null}
              </td>
              <td>
                <ReadinessChip state={r.readiness} reason={r.reason} />
                {r.pendingClaims > 0 ? (
                  <span className="rre-badge"> {r.pendingClaims} pending</span>
                ) : null}
                {r.evidenceCount > 0 ? (
                  <span className="rre-badge"> {r.evidenceCount} doc(s)</span>
                ) : null}
              </td>
              <td>
                {r.approvedValue
                  ? `${r.approvedValue}${r.approvedUnit ? ` ${r.approvedUnit}` : ''}`
                  : '—'}
              </td>
              <td>
                <div className="rre-actions">
                  {r.applicability === 'NOT_APPLICABLE_TO_CLASSIFICATION' ? null : (
                    <button
                      type="button"
                      className="rre-secondary"
                      onClick={() =>
                        setActiveControl(activeControl === r.control ? null : r.control)
                      }
                    >
                      {activeControl === r.control ? 'Close' : 'Add claim'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="rre-secondary"
                    onClick={() =>
                      setOverrideControl(overrideControl === r.control ? null : r.control)
                    }
                  >
                    {overrideControl === r.control ? 'Close' : 'Override'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {activeControl ? (
        <AddClaimForm
          entityId={id}
          control={activeControl}
          evidenceExpectation={
            matrix.rows.find((r) => r.control === activeControl)?.evidenceExpectation ?? null
          }
          onCancel={() => setActiveControl(null)}
          onDone={() => {
            setActiveControl(null)
            setVersion((v) => v + 1)
          }}
        />
      ) : null}

      {overrideControl ? (
        <OverrideForm
          entityId={id}
          control={overrideControl}
          onCancel={() => setOverrideControl(null)}
          onDone={() => {
            setOverrideControl(null)
            setVersion((v) => v + 1)
          }}
        />
      ) : null}
    </section>
  )
}
