import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { api, ApiError } from '../api/client.js'
import { getUser } from '../session.js'
import type { InviteResponse, Member, MembersResponse, PendingInvite } from '../api/types.js'

const ROLES = ['owner', 'admin', 'member'] as const

export function MembersPage(): ReactElement {
  const me = getUser()?.email ?? ''
  const [data, setData] = useState<MembersResponse | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [lastInvite, setLastInvite] = useState<{ email: string; link: string } | null>(null)

  const load = useCallback(() => {
    let live = true
    setStatus('loading')
    api
      .get<MembersResponse>('/members')
      .then((r) => {
        if (!live) return
        setData(r)
        setStatus('ok')
      })
      .catch(() => live && setStatus('error'))
    return () => {
      live = false
    }
  }, [])

  useEffect(() => load(), [load, version])

  const myRole = data?.members.find((m) => m.email === me)?.role
  const canManage = myRole === 'owner' || myRole === 'admin'
  const ownerCount = data?.members.filter((m) => m.role === 'owner').length ?? 0

  async function run(key: string, fn: () => Promise<unknown>): Promise<void> {
    setBusy(key)
    setError(null)
    try {
      await fn()
      setVersion((v) => v + 1)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.')
    } finally {
      setBusy('')
    }
  }

  async function invite(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!/.+@.+/.test(inviteEmail)) return
    setBusy('invite')
    setError(null)
    try {
      const res = await api.post<InviteResponse>('/members/invites', {
        email: inviteEmail.trim(),
        role: inviteRole,
      })
      setLastInvite({
        email: inviteEmail.trim(),
        link: `${window.location.origin}${res.acceptPath}`,
      })
      setInviteEmail('')
      setVersion((v) => v + 1)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the invite.')
    } finally {
      setBusy('')
    }
  }

  if (status === 'loading') return <p>Loading team…</p>
  if (status === 'error' || !data) return <p className="rre-error">Could not load the team.</p>

  return (
    <section>
      <h1>Team</h1>
      <p className="rre-note">Everyone with access to this workspace.</p>
      {error ? <p className="rre-error">{error}</p> : null}

      <table className="rre-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Role</th>
            {canManage ? <th aria-label="actions" /> : null}
          </tr>
        </thead>
        <tbody>
          {data.members.map((m: Member) => {
            const lastOwner = m.role === 'owner' && ownerCount <= 1
            return (
              <tr key={m.userId}>
                <td>{m.email}</td>
                <td>{m.name ?? '—'}</td>
                <td>
                  {canManage && !lastOwner ? (
                    <select
                      aria-label={`role for ${m.email}`}
                      value={m.role}
                      disabled={busy === `role-${m.userId}`}
                      onChange={(e) =>
                        run(`role-${m.userId}`, () =>
                          api.patch(`/members/${m.userId}`, { role: e.target.value }),
                        )
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    m.role
                  )}
                </td>
                {canManage ? (
                  <td>
                    {m.email === me || lastOwner ? null : (
                      <button
                        type="button"
                        className="rre-link"
                        disabled={busy === `rm-${m.userId}`}
                        onClick={() => run(`rm-${m.userId}`, () => api.del(`/members/${m.userId}`))}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                ) : null}
              </tr>
            )
          })}
        </tbody>
      </table>

      {canManage ? (
        <>
          <h2>Invite a teammate</h2>
          <form className="rre-inline-form" onSubmit={invite}>
            <label htmlFor="invite-email">Email</label>
            <input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <label htmlFor="invite-role">Role</label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
            >
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
            <button type="submit" disabled={busy === 'invite' || !/.+@.+/.test(inviteEmail)}>
              {busy === 'invite' ? 'Inviting…' : 'Send invite'}
            </button>
          </form>

          {lastInvite ? (
            <p className="rre-panel" data-testid="invite-link">
              Invite link for <strong>{lastInvite.email}</strong> — share it once:{' '}
              <code>{lastInvite.link}</code>
            </p>
          ) : null}

          {data.pendingInvites.length > 0 ? (
            <>
              <h3>Pending invites</h3>
              <ul className="rre-queue">
                {data.pendingInvites.map((i: PendingInvite) => (
                  <li key={i.id} className="rre-queue-item">
                    <strong>{i.email}</strong> · {i.role} · expires{' '}
                    {new Date(i.expiresAt).toLocaleDateString()}
                    <div className="rre-actions">
                      <button
                        type="button"
                        className="rre-link"
                        disabled={busy === `revoke-${i.id}`}
                        onClick={() =>
                          run(`revoke-${i.id}`, () =>
                            api.post(`/members/invites/${i.id}/revoke`, {}),
                          )
                        }
                      >
                        Revoke
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : (
        <p className="rre-note">Only an owner or admin can invite or change roles.</p>
      )}
    </section>
  )
}
