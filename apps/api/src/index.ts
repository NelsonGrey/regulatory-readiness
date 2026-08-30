import { createLogger, type LogLevel } from '@rre/observability'
import { createPool, migrate } from '@rre/db'
import { buildApp } from './app.js'
import {
  createInMemoryStores,
  inMemoryUnitOfWork,
  pgUnitOfWork,
  type UnitOfWork,
} from './db/uow.js'
import { pgResolveGrant } from './repositories/requests.pg.js'
import type { ResolveGrant } from './services/requests.js'

function parseLogLevel(value: string | undefined): LogLevel {
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error'
    ? value
    : 'info'
}

const logLevel = parseLogLevel(process.env.API_LOG_LEVEL)
const log = createLogger({ level: logLevel, base: { component: 'api' } })

async function main(): Promise<void> {
  const port = Number(process.env.API_PORT ?? 3000)

  let unitOfWork: UnitOfWork
  let resolveGrant: ResolveGrant | undefined

  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl) {
    const migrationPool = createPool(databaseUrl)
    const ran = await migrate(migrationPool)
    log.info('migrations', { applied: ran })
    await migrationPool.end()
    const appPool = createPool(process.env.APP_DATABASE_URL ?? databaseUrl)
    unitOfWork = pgUnitOfWork(appPool)
    resolveGrant = (hash) => pgResolveGrant(appPool, hash)
  } else {
    log.warn('DATABASE_URL not set — using in-memory storage')
    const stores = createInMemoryStores()
    unitOfWork = inMemoryUnitOfWork(stores)
    resolveGrant = async (hash) => stores.grants.find((g) => g.tokenHash === hash) ?? null
  }

  const app = buildApp({ logLevel, unitOfWork, resolveGrant })

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
