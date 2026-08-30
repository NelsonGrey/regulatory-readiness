import { createLogger, type LogLevel } from '@rre/observability'
import { handlers } from './handlers.js'

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

async function main(): Promise<void> {
  log.info('worker started', { handlers: Object.keys(handlers) })

  // Slice 3+: long-poll each SQS queue and dispatch to its handler. For now the
  // process stays alive so it can run alongside the API in local dev.
  while (running) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

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
