import { fileURLToPath } from 'node:url'
import Fastify, { type FastifyInstance } from 'fastify'
import { createLogger, type LogLevel } from '@rre/observability'
import { getPackRegistry, type PackRegistry } from './pack-registry.js'
import { createInMemoryStores, inMemoryUnitOfWork, type UnitOfWork } from './db/uow.js'
import { EntityService } from './services/entities.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerPackRoutes } from './routes/packs.js'
import { registerEntityRoutes } from './routes/entities.js'

/** Repo `packs/` directory, resolved from this file (works in dev, test, and the bundle). */
const DEFAULT_PACKS_DIR = fileURLToPath(new URL('../../../packs', import.meta.url))

export interface BuildAppOptions {
  logLevel?: LogLevel
  /** Directory of installed control-pack bundles. Defaults to `PACKS_DIR` env or the repo `packs/`. */
  packsDir?: string
  /** Pre-loaded pack registry (tests). Otherwise loaded and memoised from `packsDir`. */
  packRegistry?: PackRegistry
  /** Unit-of-work runner (persistence + audit + outbox). Defaults to a fresh in-memory one. */
  unitOfWork?: UnitOfWork
}

/**
 * Build the API instance. The modular monolith registers one route module per
 * concern; every route validates tenant, pack, role, and object ownership at the
 * trust boundary (engine Handoff §8).
 */
export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const log = createLogger({ level: options.logLevel ?? 'info', base: { component: 'api' } })
  const packsDir = options.packsDir ?? process.env.PACKS_DIR ?? DEFAULT_PACKS_DIR
  const unitOfWork = options.unitOfWork ?? inMemoryUnitOfWork(createInMemoryStores())

  const app = Fastify({ logger: false })

  app.addHook('onRequest', async (req) => {
    log.debug('request', { method: req.method, url: req.url, correlationId: req.id })
  })

  app.register(registerHealthRoutes)

  app.register(
    async (v1) => {
      const registry = options.packRegistry ?? (await getPackRegistry(packsDir))
      const entities = new EntityService(unitOfWork, registry)
      await registerPackRoutes(v1, { registry })
      await registerEntityRoutes(v1, { entities })
    },
    { prefix: '/api/v1' },
  )

  return app
}
