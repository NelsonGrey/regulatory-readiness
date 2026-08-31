import type { Logger } from '@rre/observability'
import type { Pool } from './db.js'

export interface ExpirySweepDeps {
  /** Connected as `rre_app`; the transition runs inside a SECURITY DEFINER function (migration 0008). */
  pool: Pool
  /** Cap per pass so a large backlog is drained over several ticks. */
  batchSize?: number
  now?: () => Date
  log?: Logger
}

export interface ExpirySweepResult {
  expired: number
}

/**
 * Move evidence requests whose access links have all lapsed from a non-terminal
 * status to `EXPIRED`, writing the audit event and the `request.expired` outbox
 * notification for each in the same transaction. Idempotent and concurrency-safe
 * (`FOR UPDATE SKIP LOCKED` inside the function).
 */
export async function sweepExpiredRequests({
  pool,
  batchSize = 200,
  now = () => new Date(),
  log,
}: ExpirySweepDeps): Promise<ExpirySweepResult> {
  const { rows } = await pool.query<{ expired: number }>(
    `SELECT expire_lapsed_requests($1, $2) AS expired`,
    [now().toISOString(), batchSize],
  )
  const expired = rows[0]?.expired ?? 0
  if (expired > 0) log?.info('request expiry sweep', { expired })
  return { expired }
}
