import { useEffect, useState, type ReactElement } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client.js'
import { getTenant, setTenant } from '../workspace.js'

export function Shell(): ReactElement {
  const navigate = useNavigate()
  const location = useLocation()
  const [tenant, setTenantState] = useState(getTenant())
  const [unread, setUnread] = useState<number | null>(null)

  const applyTenant = (): void => {
    setTenant(tenant)
    navigate(0) // re-run loaders with the new workspace
  }

  // Refresh the unread badge on navigation (cheap, and covers "mark read" round-trips).
  useEffect(() => {
    let live = true
    api
      .get<{ count: number }>('/notifications/unread-count')
      .then((r) => live && setUnread(r.count))
      .catch(() => live && setUnread(null))
    return () => {
      live = false
    }
  }, [location.key])

  return (
    <div className="rre-app">
      <header className="rre-header">
        <div className="rre-header-main">
          <Link to="/" className="rre-brand">
            Regulatory Readiness Engine
          </Link>
          <nav className="rre-nav">
            <Link to="/">Packs</Link>
            <Link to="/w/entities/new">New entity</Link>
            <Link to="/w/notifications">
              Notifications
              {unread ? <span className="rre-badge-count"> {unread}</span> : null}
            </Link>
          </nav>
        </div>
        <div className="rre-workspace">
          <label htmlFor="tenant">Workspace</label>
          <input
            id="tenant"
            value={tenant}
            onChange={(e) => setTenantState(e.target.value)}
            onBlur={applyTenant}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyTenant()
            }}
          />
        </div>
      </header>

      <p className="rre-limitation" role="note">
        Evidence preparation — not legal certification, conformity assessment, or authority
        approval.
      </p>

      <main className="rre-main">
        <Outlet />
      </main>
    </div>
  )
}
