import { useEffect, useState, type ReactElement } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client.js'
import { getUser } from '../session.js'
import { setTenant } from '../workspace.js'
import { SignIn } from '../components/SignIn.js'
import type { AcceptInviteResponse } from '../api/types.js'

export function JoinPage(): ReactElement {
  const { token = '' } = useParams()
  const [user, setUser] = useState(getUser())
  const [state, setState] = useState<'working' | 'done' | 'error'>('working')
  const [joined, setJoined] = useState<AcceptInviteResponse | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user) return
    let live = true
    setState('working')
    api
      .post<AcceptInviteResponse>('/invites/accept', { token })
      .then((r) => {
        if (!live) return
        setTenant(r.workspace.id)
        setJoined(r)
        setState('done')
      })
      .catch((e) => {
        if (!live) return
        setMessage(e instanceof ApiError ? e.message : 'This invite could not be used.')
        setState('error')
      })
    return () => {
      live = false
    }
  }, [user, token])

  if (!user) return <SignIn onSignedIn={() => setUser(getUser())} />

  return (
    <div className="rre-app">
      <main className="rre-main">
        <section className="rre-panel rre-signin">
          {state === 'working' ? <p>Joining…</p> : null}
          {state === 'done' && joined ? (
            <>
              <h1>You’re in</h1>
              <p>
                You joined <strong>{joined.workspace.name}</strong> as {joined.role}.
              </p>
              <Link to="/">Go to the workspace</Link>
            </>
          ) : null}
          {state === 'error' ? (
            <>
              <h1>Invite problem</h1>
              <p className="rre-error">{message}</p>
              <Link to="/">Back to your workspaces</Link>
            </>
          ) : null}
        </section>
      </main>
    </div>
  )
}
