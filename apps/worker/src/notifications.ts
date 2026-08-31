import type { Logger } from '@rre/observability'
import type { OutboxMessage } from './sqs.js'

/** A notification about to be written. `now` is applied by the writer. */
export interface NotificationDraft {
  tenantId: string
  eventTopic: string
  title: string
  body: string
  entityId: string | null
  targetType: string | null
  targetId: string | null
}

/** Persists notification rows (worker side — one per resolved tenant). */
export interface NotificationWriter {
  write(draft: NotificationDraft, now: Date): Promise<void>
}

/** Delivers a notification to an external channel (email, Slack, …). Best-effort. */
export interface Notifier {
  send(n: { tenantId: string; title: string; body: string }): Promise<void>
}

interface EventPayload {
  entityId?: string
  requestId?: string
  submissionId?: string
  snapshotId?: string
  entityStatus?: string
  version?: number
  contentHash?: string
}

/**
 * Map a domain event to a notification, or `null` for events that are not
 * operator-facing (an operator's own action, or high-frequency plumbing).
 * Deterministic and side-effect-free.
 */
export function eventToNotification(event: OutboxMessage): NotificationDraft | null {
  const p = (event.payload ?? {}) as EventPayload
  const base = {
    tenantId: event.tenantId,
    eventTopic: event.topic,
    entityId: p.entityId ?? null,
  }

  switch (event.topic) {
    case 'request.submitted':
      return {
        ...base,
        title: 'A supplier submitted a response',
        body: `Evidence request ${short(p.requestId)} has a new submission (version ${p.version ?? 1}). Review it and accept the values you want.`,
        targetType: 'evidence_request',
        targetId: p.requestId ?? null,
      }
    case 'request.expired':
      return {
        ...base,
        title: 'An evidence request expired with no response',
        body: `Evidence request ${short(p.requestId)} passed its link expiry before a submission arrived. Reissue the link or follow up another way.`,
        targetType: 'evidence_request',
        targetId: p.requestId ?? null,
      }
    case 'entity.readiness_snapshot_created':
      return {
        ...base,
        title: 'Readiness snapshot created',
        body: `A snapshot was frozen with status ${p.entityStatus ?? 'unknown'} (${short(p.contentHash)}). Exports are available from it.`,
        targetType: 'readiness_snapshot',
        targetId: p.snapshotId ?? null,
      }
    default:
      return null
  }
}

function short(v: string | undefined): string {
  if (!v) return '(unknown)'
  return v.length > 14 ? `${v.slice(0, 14)}…` : v
}

/** Console-logging notifier — the default when no external channel is configured. */
export function consoleNotifier(log: Logger): Notifier {
  return {
    async send(n) {
      log.info('notification', { tenantId: n.tenantId, title: n.title })
    },
  }
}

/** Posts to a Slack (or Slack-compatible) incoming webhook. */
export function slackWebhookNotifier(webhookUrl: string): Notifier {
  return {
    async send(n) {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: `*${n.title}*\n${n.body}` }),
      })
      if (!res.ok) throw new Error(`slack webhook ${res.status}`)
    },
  }
}

export interface HandleEventDeps {
  notifications: NotificationWriter
  notifier: Notifier
  now?: () => Date
  log?: Logger
}

/**
 * Turn one consumed event into a notification row + a best-effort external
 * send. A delivery failure is logged but does not fail the event (the row is
 * already written); an unmapped event is a no-op.
 */
export async function handleEvent(
  event: OutboxMessage,
  deps: HandleEventDeps,
): Promise<'written' | 'skipped'> {
  const draft = eventToNotification(event)
  if (!draft) return 'skipped'

  await deps.notifications.write(draft, (deps.now ?? (() => new Date()))())
  try {
    await deps.notifier.send({ tenantId: draft.tenantId, title: draft.title, body: draft.body })
  } catch (err) {
    deps.log?.warn('notifier delivery failed', { topic: event.topic, err: String(err) })
  }
  return 'written'
}
