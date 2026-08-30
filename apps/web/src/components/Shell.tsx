import { useState, type ReactElement } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { getTenant, setTenant } from '../workspace.js'

export function Shell(): ReactElement {
  const navigate = useNavigate()
  const [tenant, setTenantState] = useState(getTenant())

  const applyTenant = (): void => {
    setTenant(tenant)
    navigate(0) // re-run loaders with the new workspace
  }

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
