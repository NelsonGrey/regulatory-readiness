import pg from 'pg'

const { Pool } = pg
export type { Pool, PoolClient } from 'pg'

export function createPool(connectionString: string): pg.Pool {
  return new Pool({ connectionString, max: 10 })
}

/**
 * Run `fn` inside a transaction with `app.tenant_id` set for the duration
 * (transaction-local, like `SET LOCAL`). RLS policies restrict every read and
 * write to that tenant (ADR 0002).
 */
export async function withTenant<T>(
  pool: pg.Pool,
  tenantId: string,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId])
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
