/**
 * Contributor request + submission vocabulary (engine detailed design 02/03,
 * TRD §6.4). Browser-safe.
 */

export const REQUEST_STATUSES = [
  'DRAFT',
  'SENT',
  'IN_PROGRESS',
  'SUBMITTED',
  'CLOSED',
  'CANCELLED',
  'EXPIRED',
] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

export const AVAILABILITY_STATES = [
  'VALUE_SUPPLIED',
  'UNAVAILABLE',
  'UNKNOWN',
  'NOT_APPLICABLE',
  'NEEDS_CLARIFICATION',
] as const
export type AvailabilityState = (typeof AVAILABILITY_STATES)[number]
