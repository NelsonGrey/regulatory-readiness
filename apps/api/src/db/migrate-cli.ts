import { createPool } from './pool.js'
import { migrate } from './migrate.js'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const pool = createPool(url)
try {
  const ran = await migrate(pool, process.env.MIGRATIONS_DIR || undefined)
  console.log(ran.length > 0 ? `applied: ${ran.join(', ')}` : 'up to date')
} finally {
  await pool.end()
}
