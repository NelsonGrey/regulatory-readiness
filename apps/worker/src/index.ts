import { createLogger, type LogLevel } from '@rre/observability'
import { handlers } from './handlers.js'
import { createPool } from './db.js'
import { createSqsPublisher } from './sqs.js'
import { relayOnce } from './outbox-relay.js'
import { sweepExpiredRequests } from './expiry-sweep.js'

function parseLogLevel(value: string | undefined): LogLevel {
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error'
    ? value
    : 'info'
}

const log = createLogger({
  level: parseLogLevel(process.env.API_LOG_LEVEL),
  base: { component: 'worker' },
})

let running = true
let relayTimer: ReturnType<typeof setInterval> | undefined
let expiryTimer: ReturnType<typeof setInterval> | undefined

function startOutboxRelay(): void {
  const relayUrl = process.env.RELAY_DATABASE_URL
  const queueUrl = process.env.SQS_EVENTS_QUEUE_URL
  if (!relayUrl || !queueUrl) {
    log.warn('outbox relay disabled — set RELAY_DATABASE_URL and SQS_EVENTS_QUEUE_URL')
    return
  }

  const pool = createPool(relayUrl)
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const publisher = createSqsPublisher({
    region: process.env.AWS_REGION ?? 'eu-west-1',
    endpoint: process.env.AWS_ENDPOINT_URL,
    queueUrl,
    credentials: accessKeyId
      ? { accessKeyId, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '' }
      : undefined,
  })

  const intervalMs = Number(process.env.RELAY_INTERVAL_MS ?? 2000)
  const tick = async (): Promise<void> => {
    try {
      const result = await relayOnce({ pool, publish: publisher.publish, log })
      if (result.published > 0 || result.failed > 0) log.info('outbox relay', { ...result })
    } catch (err) {
      log.error('outbox relay tick failed', { err: String(err) })
    }
  }
  relayTimer = setInterval(() => void tick(), intervalMs)
  log.info('outbox relay started', { intervalMs })
}

function startExpirySweep(): void {
  const appUrl = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL
  if (!appUrl) {
    log.warn('request expiry sweep disabled — set APP_DATABASE_URL')
    return
  }

  const pool = createPool(appUrl)
  const intervalMs = Number(process.env.EXPIRY_SWEEP_INTERVAL_MS ?? 60_000)
  const tick = async (): Promise<void> => {
    try {
      await sweepExpiredRequests({ pool, log })
    } catch (err) {
      log.error('request expiry sweep tick failed', { err: String(err) })
    }
  }
  expiryTimer = setInterval(() => void tick(), intervalMs)
  log.info('request expiry sweep started', { intervalMs })
}

async function main(): Promise<void> {
  log.info('worker started', { handlers: Object.keys(handlers) })
  startOutboxRelay()
  startExpirySweep()

  while (running) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  if (relayTimer) clearInterval(relayTimer)
  if (expiryTimer) clearInterval(expiryTimer)
  log.info('worker stopped')
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    log.info('shutting down', { signal })
    running = false
  })
}

main().catch((err) => {
  log.error('worker crashed', { err: String(err) })
  process.exit(1)
})
