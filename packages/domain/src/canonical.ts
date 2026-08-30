/**
 * Canonical serialization: recursively sort object keys so a value has one
 * stable string form. Used for reproducibility hashes (evaluations, snapshots)
 * and content addressing.
 */

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === 'object') {
    const src = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(src).sort()) out[key] = canonicalize(src[key])
    return out
  }
  return value
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}
