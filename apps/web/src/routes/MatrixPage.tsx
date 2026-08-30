import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { useParams } from 'react-router-dom'
import { ApplicabilityChip } from '@rre/ui'
import { api, ApiError } from '../api/client.js'
import type { EntityMatrix } from '../api/types.js'

const BUCKETS: Array<{ key: keyof EntityMatrix['summary']; label: string; result: string }> = [
  { key: 'requiredNow', label: 'Required', result: 'REQUIRED_BY_SNAPSHOT' },
  { key: 'optional', label: 'Optional', result: 'OPTIONAL_IF_AVAILABLE' },
  { key: 'conditional', label: 'Needs a fact', result: 'CONDITIONAL_FACT_REQUIRED' },
  { key: 'notYetRequired', label: 'Not yet required', result: 'NOT_YET_REQUIRED_BY_SNAPSHOT' },
  { key: 'needsSpecialistReview', label: 'Specialist review', result: 'NEEDS_SPECIALIST_REVIEW' },
  { key: 'duplicate', label: 'Duplicate', result: 'DUPLICATE_SOURCE_FIELD' },
  { key: 'notApplicable', label: 'Not applicable', result: 'NOT_APPLICABLE_TO_CLASSIFICATION' },
]

export function MatrixPage(): ReactElement {
  const { id = '' } = useParams()
  const [matrix, setMatrix] = useState<EntityMatrix | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading')
  const [filter, setFilter] = useState('')

  useEffect(() => {
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

  const rows = useMemo(
    () => (matrix ? matrix.rows.filter((r) => !filter || r.applicability === filter) : []),
    [matrix, filter],
  )

  if (status === 'loading') return <p>Loading the control matrix…</p>
  if (status === 'notfound') return <p className="rre-error">Entity not found in this workspace.</p>
  if (status === 'error' || !matrix) return <p className="rre-error">Could not load the matrix.</p>

  return (
    <section>
      <h1>{matrix.entity.name}</h1>
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
          <dt>Evaluated</dt>
          <dd>{new Date(matrix.evaluation.evaluatedAt).toLocaleString()}</dd>
        </div>
      </dl>

      <p className="rre-denominator">
        {matrix.summary.requiredNow} of {matrix.summary.total} controls are required by this
        snapshot. The remaining controls are excluded with a recorded reason. This is a preparation
        status, not a compliance score.
      </p>

      <ul className="rre-summary" aria-label="controls by applicability">
        {BUCKETS.map((b) => (
          <li key={b.key}>
            <button
              type="button"
              className={filter === b.result ? 'is-active' : ''}
              onClick={() => setFilter(filter === b.result ? '' : b.result)}
            >
              <ApplicabilityChip result={b.result} /> <span>{matrix.summary[b.key]}</span>
            </button>
          </li>
        ))}
      </ul>

      <table className="rre-table">
        <thead>
          <tr>
            <th>Control</th>
            <th>Title</th>
            <th>Family</th>
            <th>Applicability</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.control}>
              <td>
                <code>{r.control}</code>
              </td>
              <td>{r.title}</td>
              <td>{r.family}</td>
              <td>
                <ApplicabilityChip result={r.applicability} />
              </td>
              <td>{r.reason ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
