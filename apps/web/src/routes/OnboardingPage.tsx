import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client.js'
import { FactField, type FactValue } from '../components/FactField.js'
import type {
  CreateEntityResponse,
  CreateRequestResponse,
  EntityMatrix,
  MatrixRow,
  PackDetail,
  PackList,
  PackSummary,
} from '../api/types.js'
import { packOptionLabel, selectablePacks } from './pack-picker.js'

type Step = 1 | 2 | 3 | 'done'

const requestable = (r: MatrixRow): boolean =>
  r.applicability !== 'NOT_APPLICABLE_TO_CLASSIFICATION' &&
  r.applicability !== 'DUPLICATE_SOURCE_FIELD'

export function OnboardingPage(): ReactElement {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [packs, setPacks] = useState<PackSummary[]>([])
  const [activationEnforced, setActivationEnforced] = useState(false)
  const [packKey, setPackKey] = useState('')
  const [detail, setDetail] = useState<PackDetail | null>(null)

  const [name, setName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [kind, setKind] = useState('product')
  const [facts, setFacts] = useState<Record<string, FactValue>>({})
  const [factErrors, setFactErrors] = useState<Record<string, string>>({})

  const [entity, setEntity] = useState<{ id: string; name: string } | null>(null)
  const [matrix, setMatrix] = useState<EntityMatrix | null>(null)
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [recipient, setRecipient] = useState('')
  const [minted, setMinted] = useState<CreateRequestResponse | null>(null)

  useEffect(() => {
    let live = true
    api
      .get<PackList>('/packs')
      .then((r) => {
        if (!live) return
        setPacks(r.packs)
        setActivationEnforced(r.activationEnforced)
      })
      .catch(() => live && setPacks([]))
    return () => {
      live = false
    }
  }, [])

  const packChoices = useMemo(
    () => selectablePacks(packs, activationEnforced),
    [packs, activationEnforced],
  )

  useEffect(() => {
    if (!packKey) return setDetail(null)
    let live = true
    api
      .get<PackDetail>(`/packs/${packKey}`)
      .then((d) => {
        if (!live) return
        setDetail(d)
        const kinds = d.entityFacts.find((f) => f.name === 'entityKind')?.enumValues
        setKind(kinds && kinds.length > 0 ? kinds[0]! : 'product')
      })
      .catch(() => live && setDetail(null))
    return () => {
      live = false
    }
  }, [packKey])

  useEffect(() => {
    if (step !== 3 || !entity) return
    let live = true
    api
      .get<EntityMatrix>(`/entities/${entity.id}/matrix`)
      .then((m) => live && setMatrix(m))
      .catch(() => live && setMatrix(null))
    return () => {
      live = false
    }
  }, [step, entity])

  const editableFacts = useMemo(
    () => (detail?.entityFacts ?? []).filter((f) => f.name !== 'entityKind'),
    [detail],
  )
  const requestRows = useMemo(() => (matrix ? matrix.rows.filter(requestable) : []), [matrix])
  const chosen = useMemo(() => Object.keys(picked).filter((k) => picked[k]), [picked])

  async function createEntity(e: FormEvent): Promise<void> {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setFactErrors({})
    try {
      const res = await api.post<CreateEntityResponse>('/entities', {
        packKey,
        name,
        entityIdentifier: identifier,
        entityKind: kind,
        facts,
      })
      setEntity({ id: res.entity.id, name: res.entity.name })
      setStep(3)
    } catch (err) {
      if (err instanceof ApiError && err.issues) {
        const byFact: Record<string, string> = {}
        for (const i of err.issues) if (i.fact) byFact[i.fact] = i.message
        setFactErrors(byFact)
      }
      setError(err instanceof ApiError ? err.message : 'Could not create the entity.')
    } finally {
      setBusy(false)
    }
  }

  async function sendRequest(): Promise<void> {
    if (!entity || chosen.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.post<CreateRequestResponse>(`/entities/${entity.id}/requests`, {
        controlKeys: chosen,
        recipientEmail: recipient.trim() || undefined,
      })
      setMinted(res)
      setStep('done')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h1>Set up your workspace</h1>
      <ol className="rre-steps" aria-label="progress">
        <li aria-current={step === 1 ? 'step' : undefined}>1. Regulation</li>
        <li aria-current={step === 2 ? 'step' : undefined}>2. First entity</li>
        <li aria-current={step === 3 ? 'step' : undefined}>3. Evidence request</li>
      </ol>

      {error ? <p className="rre-error">{error}</p> : null}

      {step === 1 ? (
        <div className="rre-panel">
          <h2>Which regulation are you preparing for?</h2>
          {packChoices.length === 0 ? (
            <p>
              {activationEnforced
                ? 'No activated regulations are available yet — an administrator needs to activate one.'
                : 'No control packs are installed yet.'}
            </p>
          ) : (
            <fieldset className="rre-facts">
              {packChoices.map((p) => (
                <label key={p.packKey} className="rre-choice">
                  <input
                    type="radio"
                    name="pack"
                    value={p.packKey}
                    checked={packKey === p.packKey}
                    onChange={() => setPackKey(p.packKey)}
                  />
                  <span>
                    {packOptionLabel(p)}
                    {p.jurisdiction ? ` · ${p.jurisdiction}` : ''}
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          <div className="rre-actions">
            <button type="button" disabled={!packKey} onClick={() => setStep(2)}>
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <form className="rre-panel rre-form" onSubmit={createEntity}>
          <h2>Add your first product or service</h2>
          {detail ? (
            <p className="rre-note">
              {detail.controlCount} controls · snapshot <code>{detail.snapshotKey}</code>
            </p>
          ) : (
            <p>Loading the {packKey} schema…</p>
          )}
          <div className="rre-field">
            <label htmlFor="ob-name">Name *</label>
            <input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="rre-field">
            <label htmlFor="ob-id">Identifier *</label>
            <input
              id="ob-id"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>
          {(detail?.entityFacts.find((f) => f.name === 'entityKind')?.enumValues ?? []).length >
          1 ? (
            <div className="rre-field">
              <label htmlFor="ob-kind">Kind *</label>
              <select id="ob-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                {(detail?.entityFacts.find((f) => f.name === 'entityKind')?.enumValues ?? []).map(
                  (v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ),
                )}
              </select>
            </div>
          ) : null}
          {detail ? (
            <fieldset className="rre-facts">
              <legend>Scope facts</legend>
              {editableFacts.map((fact) => (
                <div key={fact.name}>
                  <FactField
                    fact={fact}
                    value={facts[fact.name]}
                    onChange={(n, v) =>
                      setFacts((prev) => {
                        const next = { ...prev }
                        if (v === undefined) delete next[n]
                        else next[n] = v
                        return next
                      })
                    }
                  />
                  {factErrors[fact.name] ? (
                    <p className="rre-error">{factErrors[fact.name]}</p>
                  ) : null}
                </div>
              ))}
            </fieldset>
          ) : null}
          <div className="rre-actions">
            <button type="button" className="rre-secondary" onClick={() => setStep(1)}>
              Back
            </button>
            <button type="submit" disabled={busy || !detail}>
              {busy ? 'Creating…' : 'Create & continue'}
            </button>
          </div>
        </form>
      ) : null}

      {step === 3 && entity ? (
        <div className="rre-panel">
          <h2>Send an evidence request for “{entity.name}”</h2>
          <p className="rre-note">
            Pick a few controls to ask a colleague or supplier about. You can skip this and do it
            later.
          </p>
          {matrix ? (
            <fieldset className="rre-facts">
              {requestRows.slice(0, 12).map((r) => (
                <label key={r.control} className="rre-choice">
                  <input
                    type="checkbox"
                    checked={!!picked[r.control]}
                    onChange={(e) => setPicked((p) => ({ ...p, [r.control]: e.target.checked }))}
                  />
                  <span>
                    <code>{r.control}</code> {r.title}
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <p>Loading controls…</p>
          )}
          <div className="rre-field">
            <label htmlFor="ob-recipient">Email the link to (optional)</label>
            <input
              id="ob-recipient"
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </div>
          <div className="rre-actions">
            <button type="button" disabled={busy || chosen.length === 0} onClick={sendRequest}>
              {busy ? 'Creating…' : `Create request (${chosen.length})`}
            </button>
            <button
              type="button"
              className="rre-secondary"
              onClick={() => navigate(`/w/entities/${entity.id}/matrix`)}
            >
              Skip — go to the readiness matrix
            </button>
          </div>
        </div>
      ) : null}

      {step === 'done' && entity ? (
        <div className="rre-panel" data-testid="onboarding-done">
          <h2>You’re set up 🎉</h2>
          {minted ? (
            <p>
              Share this link once — it opens the request with no account needed:{' '}
              <code>{`${window.location.origin}/contribute/${minted.token}`}</code>
            </p>
          ) : null}
          <div className="rre-actions">
            <Link className="rre-primary" to={`/w/entities/${entity.id}/matrix`}>
              Open the readiness matrix →
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  )
}
