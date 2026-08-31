import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client.js'
import type { CreateEntityResponse, PackDetail, PackList, PackSummary } from '../api/types.js'
import { selectablePacks, packOptionLabel } from './pack-picker.js'
import { FactField, type FactValue } from '../components/FactField.js'

export function NewEntityPage(): ReactElement {
  const navigate = useNavigate()

  const [packs, setPacks] = useState<PackSummary[]>([])
  const [activationEnforced, setActivationEnforced] = useState(false)
  const [packKey, setPackKey] = useState('')
  const [detail, setDetail] = useState<PackDetail | null>(null)

  const [name, setName] = useState('')
  const [entityIdentifier, setEntityIdentifier] = useState('')
  const [entityKind, setEntityKind] = useState('product')
  const [facts, setFacts] = useState<Record<string, FactValue>>({})

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [factErrors, setFactErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .get<PackList>('/packs')
      .then((r) => {
        setPacks(r.packs)
        setActivationEnforced(r.activationEnforced)
      })
      .catch(() => setPacks([]))
  }, [])

  const options = useMemo(
    () => selectablePacks(packs, activationEnforced),
    [packs, activationEnforced],
  )

  useEffect(() => {
    if (!packKey) {
      setDetail(null)
      return
    }
    let live = true
    api
      .get<PackDetail>(`/packs/${packKey}`)
      .then((d) => {
        if (!live) return
        setDetail(d)
        setFacts({})
        setFactErrors({})
        const kinds = d.entityFacts.find((f) => f.name === 'entityKind')?.enumValues
        setEntityKind(kinds && kinds.length > 0 ? kinds[0]! : 'product')
      })
      .catch(() => live && setDetail(null))
    return () => {
      live = false
    }
  }, [packKey])

  // entityKind has its own control; the rest of the schema is rendered generically.
  const editableFacts = useMemo(
    () => (detail?.entityFacts ?? []).filter((f) => f.name !== 'entityKind'),
    [detail],
  )

  const setFact = (n: string, v: FactValue | undefined): void =>
    setFacts((prev) => {
      const next = { ...prev }
      if (v === undefined) delete next[n]
      else next[n] = v
      return next
    })

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setSubmitError(null)
    setFactErrors({})
    setBusy(true)
    try {
      const res = await api.post<CreateEntityResponse>('/entities', {
        packKey,
        name,
        entityIdentifier,
        entityKind,
        facts,
      })
      navigate(`/w/entities/${res.entity.id}/matrix`)
    } catch (err) {
      if (err instanceof ApiError && err.issues) {
        const byFact: Record<string, string> = {}
        for (const issue of err.issues) if (issue.fact) byFact[issue.fact] = issue.message
        setFactErrors(byFact)
      }
      setSubmitError(err instanceof Error ? err.message : 'Could not create the entity')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h1>New regulated entity</h1>

      <form onSubmit={onSubmit} className="rre-form">
        <div className="rre-field">
          <label htmlFor="pack">Regulation (control pack) *</label>
          <select id="pack" value={packKey} onChange={(e) => setPackKey(e.target.value)} required>
            <option value="">Choose a pack…</option>
            {options.map((p) => (
              <option key={p.packKey} value={p.packKey}>
                {packOptionLabel(p)}
              </option>
            ))}
          </select>
          {options.length === 0 ? (
            <p className="rre-note">
              {activationEnforced
                ? 'No activated regulations are available yet — an administrator needs to activate one.'
                : 'No valid control packs are installed.'}
            </p>
          ) : null}
        </div>

        {detail ? (
          <>
            <p className="rre-note">
              {detail.controlCount} controls · snapshot <code>{detail.snapshotKey}</code>
            </p>

            <div className="rre-field">
              <label htmlFor="name">Entity name *</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="rre-field">
              <label htmlFor="identifier">Entity identifier *</label>
              <input
                id="identifier"
                value={entityIdentifier}
                onChange={(e) => setEntityIdentifier(e.target.value)}
                required
              />
            </div>
            {(detail.entityFacts.find((f) => f.name === 'entityKind')?.enumValues ?? []).length >
            1 ? (
              <div className="rre-field">
                <label htmlFor="kind">Kind *</label>
                <select
                  id="kind"
                  value={entityKind}
                  onChange={(e) => setEntityKind(e.target.value)}
                >
                  {(detail.entityFacts.find((f) => f.name === 'entityKind')?.enumValues ?? []).map(
                    (v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ),
                  )}
                </select>
              </div>
            ) : null}

            <fieldset className="rre-facts">
              <legend>Scope facts</legend>
              {editableFacts.map((fact) => (
                <div key={fact.name}>
                  <FactField fact={fact} value={facts[fact.name]} onChange={setFact} />
                  {factErrors[fact.name] ? (
                    <p className="rre-error" role="alert">
                      {factErrors[fact.name]}
                    </p>
                  ) : null}
                </div>
              ))}
            </fieldset>

            {submitError ? (
              <p className="rre-error" role="alert">
                {submitError}
              </p>
            ) : null}

            <button type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create and evaluate'}
            </button>
          </>
        ) : null}
      </form>
    </section>
  )
}
