import { fileURLToPath } from 'node:url'
import Fastify, { type FastifyInstance } from 'fastify'
import { createLogger, type LogLevel } from '@rre/observability'
import { getPackRegistry, type PackRegistry } from './pack-registry.js'
import { createInMemoryStores, inMemoryUnitOfWork, type UnitOfWork } from './db/uow.js'
import { EntityService } from './services/entities.js'
import { AuditService } from './services/audit.js'
import { ClaimService } from './services/claims.js'
import { ContributorService, RequestService, type ResolveGrant } from './services/requests.js'
import { SnapshotService } from './services/snapshots.js'
import { NotificationService } from './services/notifications.js'
import { DocumentService } from './services/documents.js'
import { ExtractionService } from './services/extraction.js'
import { OverrideService } from './services/overrides.js'
import { TenantAdminService } from './services/tenant-admin.js'
import {
  AccountsService,
  InMemoryAccountsRepository,
  type AccountsRepository,
} from './services/accounts.js'
import { createLocalObjectStore, type ObjectStore } from './storage/object-store.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerPackRoutes } from './routes/packs.js'
import { registerEntityRoutes } from './routes/entities.js'
import { registerAuditRoutes } from './routes/audit.js'
import { registerClaimRoutes } from './routes/claims.js'
import { registerRequestRoutes } from './routes/requests.js'
import { registerSnapshotRoutes } from './routes/snapshots.js'
import { registerNotificationRoutes } from './routes/notifications.js'
import { registerDocumentRoutes } from './routes/documents.js'
import { registerExtractionRoutes } from './routes/extraction.js'
import { registerOverrideRoutes } from './routes/overrides.js'
import { registerTenantAdminRoutes } from './routes/tenant-admin.js'
import { registerAccountRoutes } from './routes/accounts.js'
import { registerContributorRoutes } from './routes/contributor.js'

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
  /**
   * Resolves a contributor token to its grant before the tenant is known. Must
   * be supplied whenever `unitOfWork` is; the default in-memory build derives it
   * from the same store.
   */
  resolveGrant?: ResolveGrant
  /** Object storage for document intake. Defaults to an in-memory local store. */
  objectStore?: ObjectStore
  /** Max accepted upload size in bytes. */
  maxDocumentBytes?: number
  /** Tenancy control plane (users / workspaces / memberships). Defaults to in-memory. */
  accounts?: AccountsRepository
}

/**
 * Build the API instance. The modular monolith registers one route module per
 * concern; every route validates tenant, pack, role, and object ownership at the
 * trust boundary (engine Handoff §8).
 */
export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const log = createLogger({ level: options.logLevel ?? 'info', base: { component: 'api' } })
  const packsDir = options.packsDir ?? process.env.PACKS_DIR ?? DEFAULT_PACKS_DIR

  let unitOfWork = options.unitOfWork
  let resolveGrant = options.resolveGrant
  if (!unitOfWork) {
    const stores = createInMemoryStores()
    unitOfWork = inMemoryUnitOfWork(stores)
    resolveGrant = async (hash) => stores.grants.find((g) => g.tokenHash === hash) ?? null
  }
  const resolve: ResolveGrant = resolveGrant ?? (async () => null)
  const objectStore = options.objectStore ?? createLocalObjectStore()
  const accountsRepo = options.accounts ?? new InMemoryAccountsRepository()

  const app = Fastify({ logger: false })

  // Raw-byte uploads for the local object store's content route.
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_req, body, done) =>
    done(null, body),
  )

  app.addHook('onRequest', async (req) => {
    log.debug('request', { method: req.method, url: req.url, correlationId: req.id })
  })

  app.register(registerHealthRoutes)

  app.register(
    async (v1) => {
      const registry = options.packRegistry ?? (await getPackRegistry(packsDir))
      await registerPackRoutes(v1, { registry })
      await registerEntityRoutes(v1, { entities: new EntityService(unitOfWork, registry) })
      await registerAuditRoutes(v1, { audit: new AuditService(unitOfWork) })
      await registerClaimRoutes(v1, { claims: new ClaimService(unitOfWork, registry) })
      await registerRequestRoutes(v1, { requests: new RequestService(unitOfWork, registry) })
      await registerSnapshotRoutes(v1, { snapshots: new SnapshotService(unitOfWork, registry) })
      await registerNotificationRoutes(v1, { notifications: new NotificationService(unitOfWork) })
      await registerDocumentRoutes(v1, {
        documents: new DocumentService(unitOfWork, objectStore, {
          maxBytes: options.maxDocumentBytes,
        }),
        store: objectStore,
      })
      await registerExtractionRoutes(v1, {
        extraction: new ExtractionService(unitOfWork, registry, objectStore),
      })
      await registerOverrideRoutes(v1, {
        overrides: new OverrideService(unitOfWork, registry),
      })
      await registerTenantAdminRoutes(v1, {
        tenantAdmin: new TenantAdminService(unitOfWork, objectStore),
      })
      await registerAccountRoutes(v1, {
        accounts: new AccountsService(accountsRepo, unitOfWork),
      })
    },
    { prefix: '/api/v1' },
  )

  app.register(
    async (portal) => {
      const registry = options.packRegistry ?? (await getPackRegistry(packsDir))
      await registerContributorRoutes(portal, {
        contributor: new ContributorService(unitOfWork, resolve, registry),
      })
    },
    { prefix: '/contributor/v1' },
  )

  return app
}
