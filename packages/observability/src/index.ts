/**
 * Structured logging, metrics, and trace helpers.
 *
 * OpenTelemetry-compatible so the backend (CloudWatch/X-Ray in prod, console in
 * dev) is swappable. Logs MUST exclude tokens, document text, claim values, and
 * signed URLs — see engine TRD §20.3.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogFields {
  /** Correlation id shared across a request/job. */
  correlationId?: string
  /** Tenant pseudonym — never the raw organization id in shared telemetry. */
  tenant?: string
  /** Active control-pack key. */
  pack?: string
  [key: string]: unknown
}

export interface Logger {
  child(fields: LogFields): Logger
  debug(msg: string, fields?: LogFields): void
  info(msg: string, fields?: LogFields): void
  warn(msg: string, fields?: LogFields): void
  error(msg: string, fields?: LogFields): void
}

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

/** Minimal JSON console logger for local dev. Replace the sink in production. */
export function createLogger(opts: { level?: LogLevel; base?: LogFields } = {}): Logger {
  const threshold = LEVELS[opts.level ?? 'info']
  const base = opts.base ?? {}

  const emit = (level: LogLevel, msg: string, fields?: LogFields): void => {
    if (LEVELS[level] < threshold) return
    const line = { level, time: new Date().toISOString(), msg, ...base, ...fields }
    const sink = level === 'debug' ? console.log : console[level]
    sink(JSON.stringify(line))
  }

  return {
    child: (fields) => createLogger({ level: opts.level, base: { ...base, ...fields } }),
    debug: (msg, fields) => emit('debug', msg, fields),
    info: (msg, fields) => emit('info', msg, fields),
    warn: (msg, fields) => emit('warn', msg, fields),
    error: (msg, fields) => emit('error', msg, fields),
  }
}
