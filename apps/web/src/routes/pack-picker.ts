import type { PackSummary } from '../api/types.js'

/**
 * Packs the operator may pick from: valid, and — when the server enforces pack
 * activation — only those whose governed status is `active` (otherwise
 * `POST /entities` returns `PACK_NOT_ACTIVE`).
 */
export function selectablePacks(packs: PackSummary[], activationEnforced: boolean): PackSummary[] {
  const valid = packs.filter((p) => p.valid)
  return activationEnforced ? valid.filter((p) => p.status === 'active') : valid
}

/** Option label — badges the governed status when it is not `active`. */
export function packOptionLabel(p: PackSummary): string {
  const title = p.title ?? p.packKey
  return p.status && p.status !== 'active' ? `${title} — ${p.status}` : title
}
