import { useState, type ReactElement } from 'react'
import { setUser } from '../session.js'

/**
 * Dev stand-in for single sign-on: the email identifies the person to the API
 * and across workspaces. A real identity provider replaces this component.
 */
export function SignIn({ onSignedIn }: { onSignedIn: () => void }): ReactElement {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const valid = /.+@.+/.test(email)

  return (
    <div className="rre-app">
      <main className="rre-main">
        <section className="rre-panel rre-signin">
          <h1>Sign in</h1>
          <p className="rre-note">
            A stand-in for single sign-on. Your work email identifies you to the workspace.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!valid) return
              setUser({ email: email.trim(), name: name.trim() || undefined })
              onSignedIn()
            }}
          >
            <label htmlFor="signin-email">Work email</label>
            <input
              id="signin-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label htmlFor="signin-name">Name (optional)</label>
            <input
              id="signin-name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="rre-actions">
              <button type="submit" disabled={!valid}>
                Continue
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  )
}
