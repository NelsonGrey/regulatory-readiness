/** Subscription plans and their hard limits (engine TRD §3.4). */
export type Plan = 'trial' | 'starter' | 'growth'

export interface PlanLimits {
  /** Regulated entities the workspace may hold. */
  entities: number
  /** Members + pending invites. */
  seats: number
  /** Total stored document bytes. */
  storageBytes: number
}

const MB = 1024 * 1024
const GB = 1024 * MB

export const PLANS: Record<Plan, { label: string; limits: PlanLimits }> = {
  trial: { label: 'Trial', limits: { entities: 3, seats: 3, storageBytes: 100 * MB } },
  starter: { label: 'Starter', limits: { entities: 25, seats: 10, storageBytes: 5 * GB } },
  growth: {
    label: 'Growth',
    limits: {
      entities: Number.POSITIVE_INFINITY,
      seats: Number.POSITIVE_INFINITY,
      storageBytes: 50 * GB,
    },
  },
}

export const PLAN_KEYS: readonly Plan[] = ['trial', 'starter', 'growth']

export function limitsFor(plan: Plan): PlanLimits {
  return PLANS[plan].limits
}

/** JSON cannot carry `Infinity`; surface an unlimited quota as `null`. */
export function limitsToJson(l: PlanLimits): Record<keyof PlanLimits, number | null> {
  const n = (v: number): number | null => (Number.isFinite(v) ? v : null)
  return { entities: n(l.entities), seats: n(l.seats), storageBytes: n(l.storageBytes) }
}
