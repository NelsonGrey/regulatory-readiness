import type { ReactElement } from 'react'
import type { EntityFact } from '../api/types.js'

export type FactValue = string | boolean | number

export interface FactFieldProps {
  fact: EntityFact
  value: FactValue | undefined
  onChange: (name: string, value: FactValue | undefined) => void
}

/** Renders one pack-declared fact as a labelled control (engine detailed design 01 §10). */
export function FactField({ fact, value, onChange }: FactFieldProps): ReactElement {
  const id = `fact-${fact.name}`
  const label = (
    <label htmlFor={id}>
      {fact.name}
      {fact.required ? <span aria-hidden="true"> *</span> : null}
    </label>
  )

  let control: ReactElement
  if (fact.type === 'boolean') {
    control = (
      <select
        id={id}
        value={value === undefined ? '' : String(value)}
        onChange={(e) =>
          onChange(fact.name, e.target.value === '' ? undefined : e.target.value === 'true')
        }
      >
        <option value="">—</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    )
  } else if (fact.type === 'enum') {
    control = (
      <select
        id={id}
        value={value === undefined ? '' : String(value)}
        onChange={(e) => onChange(fact.name, e.target.value === '' ? undefined : e.target.value)}
      >
        <option value="">—</option>
        {(fact.enumValues ?? []).map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    )
  } else if (fact.type === 'number') {
    control = (
      <input
        id={id}
        type="number"
        value={value === undefined ? '' : String(value)}
        onChange={(e) =>
          onChange(fact.name, e.target.value === '' ? undefined : Number(e.target.value))
        }
      />
    )
  } else {
    control = (
      <input
        id={id}
        type="text"
        value={value === undefined ? '' : String(value)}
        onChange={(e) => onChange(fact.name, e.target.value === '' ? undefined : e.target.value)}
      />
    )
  }

  return (
    <div className="rre-field">
      {label}
      {control}
      {fact.description ? <p className="rre-field-help">{fact.description}</p> : null}
    </div>
  )
}
