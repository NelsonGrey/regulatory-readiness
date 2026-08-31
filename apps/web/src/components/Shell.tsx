import { useEffect, useState, type ReactElement } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client.js'
import type { CreateWorkspaceResponse, Workspace, WorkspaceList } from '../api/types.js'
import { getTenant, setTenant } from '../workspace.js'
import { clearUser, getUser } from '../session.js'
import { SignIn } from './SignIn.js'

function CreateFirstWorkspace({ onCreated }: { onCreated: () => void }): ReactElement {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.post<CreateWorkspaceResponse>('/sign-up', {
        workspaceName: name.trim(),
      })
      setTenant(res.workspace.id)
      onCreated()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the workspace.')
      setBusy(false)
    }
  }

  return (
    <div className="rre-app">
      <main className="rre-main">
        <section className="rre-panel rre-signin">
          <h1>Create your workspace</h1>
          <p className="rre-note">One workspace per organisation. You can add more later.</p>
          {error ? <p className="rre-error">{error}</p> : null}
          <form onSubmit={create}>
            <label htmlFor="ws-name">Workspace name</label>
            <input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="rre-actions">
              <button type="submit" disabled={busy || !name.trim()}>
                {busy ? 'Creating…' : 'Create workspace'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  )
}

export function Shell(): ReactElement {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUserState] = useState(getUser())
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null)
  const [wsError, setWsError] = useState(false)
  const [unread, setUnread] = useState<number | null>(null)
  const current = getTenant()

  // Load the caller's workspaces once signed in. A failure is non-fatal — the
  // picker falls back to the current id so the app still works offline.
  useEffect(() => {
    if (!user) return
    let live = true
    api
      .get<WorkspaceList>('/workspaces')
      .then((r) => {
        if (!live) return
        // Adopt the first workspace only when the stored id is unknown to us.
        if (r.workspaces.length > 0 && !r.workspaces.some((w) => w.id === current)) {
          setTenant(r.workspaces[0]!.id)
        }
        setWorkspaces(r.workspaces)
        setWsError(false)
      })
      .catch(() => {
        if (!live) return
        setWorkspaces([])
        setWsError(true)
      })
    return () => {
      live = false
    }
  }, [user, current, navigate])

  useEffect(() => {
    if (!user) return
    let live = true
    api
      .get<{ count: number }>('/notifications/unread-count')
      .then((r) => live && setUnread(r.count))
      .catch(() => live && setUnread(null))
    return () => {
      live = false
    }
  }, [location.key, user])

  if (!user) return <SignIn onSignedIn={() => setUserState(getUser())} />
  if (workspaces === null) {
    return (
      <div className="rre-app">
        <main className="rre-main">
          <p>Loading…</p>
        </main>
      </div>
    )
  }
  if (workspaces.length === 0 && !wsError) {
    return <CreateFirstWorkspace onCreated={() => navigate(0)} />
  }

  const options = workspaces.length > 0 ? workspaces : [{ id: current, name: current }]

  const switchWorkspace = (id: string): void => {
    if (id === current) return
    setTenant(id)
    navigate(0)
  }

  async function newWorkspace(): Promise<void> {
    const name = window.prompt('New workspace name')?.trim()
    if (!name) return
    try {
      const res = await api.post<CreateWorkspaceResponse>('/workspaces', { name })
      switchWorkspace(res.workspace.id)
    } catch {
      /* surfaced on the next load */
    }
  }

  function signOut(): void {
    clearUser()
    setUserState(null)
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
            <Link to="/w/notifications">
              Notifications
              {unread ? <span className="rre-badge-count"> {unread}</span> : null}
            </Link>
            <Link to="/w/settings/members">Team</Link>
            <Link to="/w/settings/deletion">Data &amp; deletion</Link>
          </nav>
        </div>
        <div className="rre-workspace">
          <label htmlFor="workspace">Workspace</label>
          <select id="workspace" value={current} onChange={(e) => switchWorkspace(e.target.value)}>
            {options.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <button type="button" className="rre-secondary" onClick={newWorkspace}>
            New
          </button>
          <span className="rre-user">
            {user.email}
            <button type="button" className="rre-link" onClick={signOut}>
              Sign out
            </button>
          </span>
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
