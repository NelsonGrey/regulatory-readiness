import type { Logger } from '@rre/observability'
import type { Pool } from './db.js'
import type { OutboxMessage } from './sqs.js'

export interface RelayDeps {
  /** Connected as `rre_relay` (BYPASSRLS) so every tenant's rows are visible (migration 0004). */
  pool: Pool
  publish: (msg: OutboxMessage) => Promise<void>
  batchSize?: number
  log?: Logger
}

export interface RelayResult {
  published: number
  failed: number
}

interface OutboxRow {
  id: string
  tenant_id: string
  topic: string
  payload: unknown
}

/**
 * Drain one batch of unpublished outbox rows (ADR 0004). Rows are locked with
 * `FOR UPDATE SKIP LOCKED` so multiple relay instances can run concurrently.
 * A successful publish sets `published_at`; a failure bumps `attempts` and the
 * row is retried on the next pass. Publication is at-least-once — consumers are
 * idempotent.
 */
export async function relayOnce({
  pool,
  publish,
  batchSize = 50,
  log,
}: RelayDeps): Promise<RelayResult> {
  const client = await pool.connect()
  let published = 0
  let failed = 0
  try {
    await client.query('BEGIN')
    const { rows } = await client.query<OutboxRow>(
      `SELECT id, tenant_id, topic, payload
         FROM outbox
        WHERE published_at IS NULL
        ORDER BY seq
        LIMIT $1
        FOR UPDATE SKIP LOCKED`,
      [batchSize],
    )

    for (const row of rows) {
      try {
        await publish({
          id: row.id,
          topic: row.topic,
          tenantId: row.tenant_id,
          payload: row.payload,
        })
        await client.query(`UPDATE outbox SET published_at = now() WHERE id = $1`, [row.id])
        published++
      } catch (err) {
        await client.query(`UPDATE outbox SET attempts = attempts + 1 WHERE id = $1`, [row.id])
        failed++
        log?.warn('outbox publish failed', { outboxId: row.id, err: String(err) })
      }
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return { published, failed }
}
