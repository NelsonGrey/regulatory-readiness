import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { api, ApiError } from '../api/client.js'
import type { BillingSummary, CheckoutResponse } from '../api/types.js'

const PLAN_LABEL: Record<string, string> = {
  trial: 'Trial',
  starter: 'Starter',
  growth: 'Growth',
}
const STATUS_LABEL: Record<string, string> = {
  trialing: 'Trial',
  active: 'Active',
  past_due: 'Past due',
  canceled: 'Canceled',
}

const fmtLimit = (n: number | null): string => (n === null ? 'Unlimited' : String(n))

export function BillingPage(): ReactElement {
  const [data, setData] = useState<BillingSummary | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    let live = true
    setStatus('loading')
    api
      .get<BillingSummary>('/billing')
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

  useEffect(() => load(), [load])

  async function go(key: string, path: string, payload?: unknown): Promise<void> {
    setBusy(key)
    setError(null)
    try {
      const res = await api.post<CheckoutResponse>(path, payload ?? {})
      window.location.assign(res.url)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not reach the billing provider.')
      setBusy('')
    }
  }

  if (status === 'loading') return <p>Loading billing…</p>
  if (status === 'error' || !data) return <p className="rre-error">Could not load billing.</p>

  const trialing = data.status === 'trialing' && data.trialEndsAt
  const atEntityCap = data.limits.entities !== null && data.usage.entities >= data.limits.entities
  const atSeatCap = data.limits.seats !== null && data.usage.seats >= data.limits.seats

  return (
    <section>
      <h1>Plan &amp; billing</h1>
      {error ? <p className="rre-error">{error}</p> : null}

      <p>
        <strong>{PLAN_LABEL[data.plan] ?? data.plan}</strong> ·{' '}
        {STATUS_LABEL[data.status] ?? data.status}
        {trialing
          ? ` · trial ends ${new Date(data.trialEndsAt as string).toLocaleDateString()}`
          : ''}
        {data.status === 'active' && data.currentPeriodEnd
          ? ` · renews ${new Date(data.currentPeriodEnd).toLocaleDateString()}`
          : ''}
      </p>

      <table className="rre-table">
        <thead>
          <tr>
            <th>Resource</th>
            <th>Used</th>
            <th>Limit</th>
          </tr>
        </thead>
        <tbody>
          <tr data-testid="usage-entities" data-over={atEntityCap ? 'true' : undefined}>
            <td>Entities</td>
            <td>{data.usage.entities}</td>
            <td>{fmtLimit(data.limits.entities)}</td>
          </tr>
          <tr data-testid="usage-seats" data-over={atSeatCap ? 'true' : undefined}>
            <td>Seats</td>
            <td>{data.usage.seats}</td>
            <td>{fmtLimit(data.limits.seats)}</td>
          </tr>
        </tbody>
      </table>

      <h2>Change plan</h2>
      <div className="rre-actions">
        {data.plan !== 'starter' ? (
          <button
            type="button"
            disabled={busy !== ''}
            onClick={() => go('starter', '/billing/checkout', { plan: 'starter' })}
          >
            {busy === 'starter' ? 'Redirecting…' : 'Upgrade to Starter'}
          </button>
        ) : null}
        {data.plan !== 'growth' ? (
          <button
            type="button"
            disabled={busy !== ''}
            onClick={() => go('growth', '/billing/checkout', { plan: 'growth' })}
          >
            {busy === 'growth' ? 'Redirecting…' : 'Upgrade to Growth'}
          </button>
        ) : null}
        {data.status !== 'trialing' ? (
          <button
            type="button"
            className="rre-secondary"
            disabled={busy !== ''}
            onClick={() => go('portal', '/billing/portal')}
          >
            {busy === 'portal' ? 'Redirecting…' : 'Manage billing'}
          </button>
        ) : null}
      </div>
    </section>
  )
}
