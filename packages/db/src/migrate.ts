import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Pool } from 'pg'

/** Repo `migrations/` directory (dev path; override for a bundled runtime). */
export const DEFAULT_MIGRATIONS_DIR = fileURLToPath(new URL('../../../migrations', import.meta.url))

/**
 * Forward-only SQL migrations (engine Handoff §9). Each `NNNN_*.sql` file runs
 * once, in filename order, inside its own transaction; applied versions are
 * tracked in `schema_migrations`.
 */
export async function migrate(
  pool: Pool,
  migrationsDir: string = DEFAULT_MIGRATIONS_DIR,
): Promise<string[]> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version    text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  )

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort()
  const applied = new Set(
    (await pool.query<{ version: string }>('SELECT version FROM schema_migrations')).rows.map(
      (r) => r.version,
    ),
  )

  const ran: string[] = []
  for (const file of files) {
    if (applied.has(file)) continue
    const sql = await readFile(join(migrationsDir, file), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file])
      await client.query('COMMIT')
      ran.push(file)
    } catch (err) {
      await client.query('ROLLBACK')
      throw new Error(`migration ${file} failed: ${String(err)}`)
    } finally {
      client.release()
    }
  }
  return ran
}
