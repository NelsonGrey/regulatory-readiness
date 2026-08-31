import { describe, expect, it, vi } from 'vitest'
import {
  eventToNotification,
  handleEvent,
  type NotificationDraft,
  type NotificationWriter,
  type Notifier,
} from './notifications.js'
import type { OutboxMessage } from './sqs.js'

const event = (topic: string, payload: unknown): OutboxMessage => ({
  id: 'obx_1',
  topic,
  tenantId: 't-alpha',
  payload,
})

describe('eventToNotification', () => {
  it('maps the operator-facing events', () => {
    expect(
      eventToNotification(event('request.submitted', { requestId: 'req_1', version: 2 })),
    ).toMatchObject({
      tenantId: 't-alpha',
      title: expect.stringMatching(/supplier submitted/i),
      targetType: 'evidence_request',
      targetId: 'req_1',
    })
    expect(
      eventToNotification(event('request.expired', { requestId: 'req_1', entityId: 'ent_1' })),
    ).toMatchObject({ title: expect.stringMatching(/expired/i), entityId: 'ent_1' })
    expect(
      eventToNotification(
        event('entity.readiness_snapshot_created', {
          snapshotId: 'rsnap_1',
          entityStatus: 'BLOCKED',
        }),
      ),
    ).toMatchObject({ title: expect.stringMatching(/snapshot/i), targetType: 'readiness_snapshot' })
  })

  it('returns null for events that are the operator’s own action or plumbing', () => {
    for (const t of [
      'request.created',
      'request.sent',
      'request.revoked',
      'request.link_reissued',
      'entity.readiness_evaluated',
    ]) {
      expect(eventToNotification(event(t, {}))).toBeNull()
    }
  })
})

describe('handleEvent', () => {
  const capturingWriter = (): { writer: NotificationWriter; written: NotificationDraft[] } => {
    const written: NotificationDraft[] = []
    return { writer: { write: async (d) => void written.push(d) }, written }
  }

  it('writes a row and sends externally for a mapped event', async () => {
    const { writer, written } = capturingWriter()
    const notifier: Notifier = { send: vi.fn(async () => {}) }
    const outcome = await handleEvent(event('request.submitted', { requestId: 'req_1' }), {
      notifications: writer,
      notifier,
    })
    expect(outcome).toBe('written')
    expect(written).toHaveLength(1)
    expect(notifier.send).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't-alpha', title: expect.any(String) }),
    )
  })

  it('still counts as written when external delivery throws', async () => {
    const { writer, written } = capturingWriter()
    const notifier: Notifier = {
      send: async () => {
        throw new Error('slack 500')
      },
    }
    const outcome = await handleEvent(event('request.expired', { requestId: 'req_1' }), {
      notifications: writer,
      notifier,
      log: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
    })
    expect(outcome).toBe('written')
    expect(written).toHaveLength(1)
  })

  it('skips an unmapped event without touching the writer', async () => {
    const { writer, written } = capturingWriter()
    const notifier: Notifier = { send: vi.fn(async () => {}) }
    const outcome = await handleEvent(event('request.created', {}), {
      notifications: writer,
      notifier,
    })
    expect(outcome).toBe('skipped')
    expect(written).toHaveLength(0)
    expect(notifier.send).not.toHaveBeenCalled()
  })
})
