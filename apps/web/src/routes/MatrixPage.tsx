import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApplicabilityChip, ReadinessChip } from '@rre/ui'
import { api, ApiError } from '../api/client.js'
import type { EntityMatrix, MatrixRow } from '../api/types.js'
import { AddClaimForm } from '../components/AddClaimForm.js'

const ENTITY_STATUS_LABEL: Record<string, string> = {
  BLOCKED: 'Blocked — required evidence is missing, conflicting, or stale',
  REVIEW_NEEDED: 'Review needed — proposals await an approver',
  EVIDENCE_READY: 'Evidence ready for this snapshot',
  OUTDATED_SNAPSHOT: 'A newer control snapshot is available',
}

const READINESS_ORDER = [
  'EVIDENCED',
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
  const [version, setVersion] = useState(0)

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
              </td>
              <td>
                <ReadinessChip state={r.readiness} reason={r.reason} />
                {r.pendingClaims > 0 ? (
                  <span className="rre-badge"> {r.pendingClaims} pending</span>
                ) : null}
              </td>
              <td>
                {r.approvedValue
                  ? `${r.approvedValue}${r.approvedUnit ? ` ${r.approvedUnit}` : ''}`
                  : '—'}
              </td>
              <td>
                {r.applicability === 'NOT_APPLICABLE_TO_CLASSIFICATION' ? null : (
                  <button
                    type="button"
                    className="rre-secondary"
                    onClick={() => setActiveControl(activeControl === r.control ? null : r.control)}
                  >
                    {activeControl === r.control ? 'Close' : 'Add claim'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {activeControl ? (
        <AddClaimForm
          entityId={id}
          control={activeControl}
          onCancel={() => setActiveControl(null)}
          onDone={() => {
            setActiveControl(null)
            setVersion((v) => v + 1)
          }}
        />
      ) : null}
    </section>
  )
}
