import { createLogger, type LogLevel } from '@rre/observability'
import { buildApp } from './app.js'
import { createPool } from './db/pool.js'
import { migrate } from './db/migrate.js'
import { PgEntityRepository } from './repositories/entities.pg.js'
import { InMemoryEntityRepository, type EntityRepository } from './services/entities.js'

function parseLogLevel(value: string | undefined): LogLevel {
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error'
    ? value
    : 'info'
}

const logLevel = parseLogLevel(process.env.API_LOG_LEVEL)
const log = createLogger({ level: logLevel, base: { component: 'api' } })

async function main(): Promise<void> {
  const port = Number(process.env.API_PORT ?? 3000)

  let entityRepository: EntityRepository
  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl) {
    // Migrations run as the owner (DATABASE_URL); the app connects as the
    // non-superuser role so RLS is enforced (APP_DATABASE_URL, ADR 0002).
    const migrationPool = createPool(databaseUrl)
    const ran = await migrate(migrationPool)
    log.info('migrations', { applied: ran })
    await migrationPool.end()
    entityRepository = new PgEntityRepository(
      createPool(process.env.APP_DATABASE_URL ?? databaseUrl),
    )
  } else {
    log.warn('DATABASE_URL not set — using in-memory entity storage')
    entityRepository = new InMemoryEntityRepository()
  }

  const app = buildApp({ logLevel, entityRepository })

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      log.info('shutting down', { signal })
      void app.close().then(() => process.exit(0))
    })
  }

  const address = await app.listen({ port, host: '0.0.0.0' })
  log.info('api listening', { address })
}

main().catch((err) => {
  log.error('api failed to start', { err: String(err) })
  process.exit(1)
})
