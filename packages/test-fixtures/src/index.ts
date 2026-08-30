/**
 * Deterministic fixtures: tenants, entities, documents, and control cases that
 * span every readiness/applicability state. Seeded clocks and IDs only — no
 * randomness (engine Handoff §11.3).
 */
import type { ReadinessState } from '@rre/domain'

/** A fixed instant used as "now" across tests. */
export const FIXED_NOW = new Date('2026-08-30T12:00:00.000Z')

/** One control row per readiness state, for matrix/readiness fixtures. */
export const EVERY_READINESS_STATE: readonly ReadinessState[] = [
  'EVIDENCED',
  'MISSING',
  'CONFLICTING',
  'STALE',
  'PENDING_REVIEW',
  'CONDITIONAL',
  'NOT_YET_REQUIRED',
  'NOT_APPLICABLE',
]

export interface SeededTenant {
  id: string
  legalName: string
  dataRegion: string
}

export const tenantA: SeededTenant = {
  id: 'tnt_00000000000000000000000001',
  legalName: 'Alpha Mobility BV',
  dataRegion: 'eu-west-1',
}

export const tenantB: SeededTenant = {
  id: 'tnt_00000000000000000000000002',
  legalName: 'Beta Rides GmbH',
  dataRegion: 'eu-west-1',
}
