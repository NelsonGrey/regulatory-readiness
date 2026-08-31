import { useEffect, useState, type ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import type { EntityList, EntitySummary } from '../api/types.js'

const STATUS: Record<string, { label: string; tone: string }> = {
  EVIDENCE_READY: { label: 'Evidence ready', tone: 'ok' },
  REVIEW_NEEDED: { label: 'Review needed', tone: 'warn' },
  BLOCKED: { label: 'Blocked', tone: 'bad' },
  OUTDATED_SNAPSHOT: { label: 'Outdated snapshot', tone: 'warn' },
}

function readinessSummary(counts: Record<string, number>): string {
  const parts: string[] = []
  const push = (key: string, word: string): void => {
    if (counts[key]) parts.push(`${counts[key]} ${word}`)
  }
  push('EVIDENCED', 'evidenced')
  push('SELF_ATTESTED', 'self-attested')
  push('PENDING_REVIEW', 'in review')
  push('MISSING', 'missing')
  push('CONFLICTING', 'conflicting')
  push('STALE', 'stale')
  return parts.join(' · ') || 'nothing required yet'
}

export function DashboardPage(): ReactElement {
  const [entities, setEntities] = useState<EntitySummary[] | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    let live = true
    api
      .get<EntityList>('/entities')
      .then((r) => {
        if (!live) return
        setEntities(r.entities)
        setStatus('ok')
      })
      .catch(() => live && setStatus('error'))
    return () => {
      live = false
    }
  }, [])

  if (status === 'loading') return <p>Loading your workspace…</p>
  if (status === 'error' || !entities)
    return <p className="rre-error">Could not load your workspace.</p>

  if (entities.length === 0) {
    return (
      <section>
        <h1>Workspace</h1>
        <div className="rre-panel" data-testid="onboarding-cta">
          <h2>New here?</h2>
          <p>
            Set up your workspace in three quick steps — pick a regulation, add your first product
            or service, and send an evidence request.
          </p>
          <Link className="rre-primary" to="/w/onboarding">
            Get started →
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section>
      <h1>Workspace</h1>
      <p className="rre-actions">
        <Link className="rre-primary" to="/w/entities/new">
          New entity
        </Link>
        <Link className="rre-secondary" to="/w/packs">
          Browse control packs
        </Link>
      </p>

      <table className="rre-table">
        <thead>
          <tr>
            <th>Entity</th>
            <th>Regulation</th>
            <th>Status</th>
            <th>Readiness</th>
            <th aria-label="links" />
          </tr>
        </thead>
        <tbody>
          {entities.map((e) => {
            const s = STATUS[e.entityStatus] ?? { label: e.entityStatus, tone: 'warn' }
            return (
              <tr key={e.id} data-testid={`entity-${e.id}`}>
                <td>
                  <Link to={`/w/entities/${e.id}/matrix`}>{e.name}</Link>
                  <div className="rre-note">
                    <code>{e.entityIdentifier}</code> · {e.entityKind}
                  </div>
                </td>
                <td>
                  <code>{e.packKey}</code>
                </td>
                <td>
                  <span className={`rre-badge rre-badge-${s.tone}`}>{s.label}</span>
                </td>
                <td>{readinessSummary(e.readinessCounts)}</td>
                <td>
                  <Link to={`/w/entities/${e.id}/requests`}>Requests</Link>
                  {' · '}
                  <Link to={`/w/entities/${e.id}/documents`}>Documents</Link>
                  {' · '}
                  <Link to={`/w/entities/${e.id}/snapshots`}>Snapshots</Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
