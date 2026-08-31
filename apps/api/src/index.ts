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
import { PgAccountsRepository } from './repositories/accounts.pg.js'
import { PgBillingRepository } from './repositories/billing.pg.js'
import { PgPackGovernanceRepository } from './repositories/pack-governance.pg.js'
import {
  InMemoryPackGovernanceRepository,
  type PackGovernanceRepository,
} from './services/pack-governance.js'
import { InMemoryAccountsRepository, type AccountsRepository } from './services/accounts.js'
import { InMemoryBillingRepository, type BillingRepository } from './services/billing.js'
import {
  noopBillingProvider,
  stripeBillingProvider,
  type BillingProvider,
} from './billing/provider.js'
import type { Plan } from './billing/plans.js'
import { consoleEmailSender, resendEmailSender, type EmailSender } from './email/sender.js'
import { headerVerifier, jwtVerifier, type PrincipalVerifier } from './auth/verifier.js'
import type { ResolveGrant } from './services/requests.js'
import { createLocalObjectStore, type ObjectStore } from './storage/object-store.js'
import { createS3ObjectStore } from './storage/object-store.s3.js'

function parseLogLevel(value: string | undefined): LogLevel {
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error'
    ? value
    : 'info'
}

const logLevel = parseLogLevel(process.env.API_LOG_LEVEL)
const log = createLogger({ level: logLevel, base: { component: 'api' } })

function buildObjectStore(): ObjectStore {
  const originals = process.env.S3_BUCKET_ORIGINALS
  const quarantine = process.env.S3_BUCKET_QUARANTINE
  if (!originals || !quarantine) return createLocalObjectStore()
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  return createS3ObjectStore({
    region: process.env.AWS_REGION ?? 'eu-west-1',
    endpoint: process.env.AWS_ENDPOINT_URL,
    originalsBucket: originals,
    quarantineBucket: quarantine,
    credentials: accessKeyId
      ? { accessKeyId, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '' }
      : undefined,
  })
}

async function main(): Promise<void> {
  const port = Number(process.env.API_PORT ?? 3000)

  let unitOfWork: UnitOfWork
  let resolveGrant: ResolveGrant | undefined
  let accounts: AccountsRepository
  let billingRepo: BillingRepository
  let packGovernanceRepo: PackGovernanceRepository

  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl) {
    const migrationPool = createPool(databaseUrl)
    const ran = await migrate(migrationPool)
    log.info('migrations', { applied: ran })
    await migrationPool.end()
    const appPool = createPool(process.env.APP_DATABASE_URL ?? databaseUrl)
    unitOfWork = pgUnitOfWork(appPool)
    resolveGrant = (hash) => pgResolveGrant(appPool, hash)
    accounts = new PgAccountsRepository(appPool)
    billingRepo = new PgBillingRepository(appPool)
    packGovernanceRepo = new PgPackGovernanceRepository(appPool)
  } else {
    log.warn('DATABASE_URL not set — using in-memory storage')
    const stores = createInMemoryStores()
    unitOfWork = inMemoryUnitOfWork(stores)
    resolveGrant = async (hash) => stores.grants.find((g) => g.tokenHash === hash) ?? null
    accounts = new InMemoryAccountsRepository()
    billingRepo = new InMemoryBillingRepository()
    packGovernanceRepo = new InMemoryPackGovernanceRepository()
  }

  const platformAdmins = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const stripePrices: Partial<Record<Plan, string>> = {
    starter: process.env.STRIPE_PRICE_STARTER,
    growth: process.env.STRIPE_PRICE_GROWTH,
  }
  let emailSender: EmailSender
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    emailSender = resendEmailSender({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM,
    })
    log.info('email', { sender: 'resend' })
  } else {
    emailSender = consoleEmailSender((e, m) => log.info(e, m))
    log.warn('email', { sender: 'console' })
  }

  let billingProvider: BillingProvider
  if (process.env.STRIPE_SECRET_KEY) {
    billingProvider = stripeBillingProvider({
      secretKey: process.env.STRIPE_SECRET_KEY,
      prices: stripePrices,
    })
    log.info('billing', { provider: 'stripe' })
  } else {
    billingProvider = noopBillingProvider()
    log.warn('billing', { provider: 'noop' })
  }

  const objectStore = buildObjectStore()
  log.info('object store', { kind: objectStore.kind })

  // A real IdP when AUTH_JWT_ISSUER + AUTH_JWKS_URI are set; the header stand-in
  // otherwise. Works with any RS256 OIDC provider (Clerk, WorkOS, Auth0, …).
  let principalVerifier: PrincipalVerifier
  const jwtIssuer = process.env.AUTH_JWT_ISSUER
  const jwksUri = process.env.AUTH_JWKS_URI
  if (jwtIssuer && jwksUri) {
    principalVerifier = jwtVerifier({
      issuer: jwtIssuer,
      jwksUri,
      audience: process.env.AUTH_JWT_AUDIENCE,
    })
    log.info('auth', { verifier: 'jwt', issuer: jwtIssuer })
  } else {
    principalVerifier = headerVerifier()
    log.warn('auth', { verifier: 'header-stand-in' })
  }

  const maxDocumentBytes = process.env.DOCUMENT_MAX_BYTES
    ? Number(process.env.DOCUMENT_MAX_BYTES)
    : undefined

  const app = buildApp({
    logLevel,
    unitOfWork,
    resolveGrant,
    objectStore,
    maxDocumentBytes,
    accounts,
    principalVerifier,
    billingRepo,
    billingProvider,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    stripePrices,
    appBaseUrl: process.env.APP_BASE_URL,
    emailSender,
    packGovernanceRepo,
    platformAdmins,
    requirePackActivation: process.env.ALLOW_DRAFT_PACKS !== '1',
    devAuth: process.env.DEV_AUTH === '1',
  })

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
