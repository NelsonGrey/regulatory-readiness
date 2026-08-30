/**
 * Queue-handler registry. One handler per SQS queue (engine ARCHITECTURE_AWS §4):
 * malware-scan result, OCR, extraction, export generation, notification delivery.
 * Every handler re-authorizes tenant/pack/object state and is idempotent
 * (engine Handoff §8).
 */
import type { Logger } from '@rre/observability'

export interface JobContext {
  log: Logger
}

export type JobHandler = (message: unknown, ctx: JobContext) => Promise<void>

export const handlers: Record<string, JobHandler> = {
  'scan-result': async (_message, { log }) => {
    log.warn('scan-result handler not implemented')
  },
  ocr: async (_message, { log }) => {
    log.warn('ocr handler not implemented')
  },
  extraction: async (_message, { log }) => {
    log.warn('extraction handler not implemented')
  },
  export: async (_message, { log }) => {
    log.warn('export handler not implemented')
  },
  notify: async (_message, { log }) => {
    log.warn('notify handler not implemented')
  },
}
