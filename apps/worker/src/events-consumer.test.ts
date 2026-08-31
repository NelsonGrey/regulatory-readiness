import { describe, expect, it, vi } from 'vitest'
import { consumeEventsOnce } from './events-consumer.js'
import type { OutboxMessage } from './sqs.js'

function fakeConsumer(bodies: string[]) {
  const acked: string[] = []
  const messages = bodies.map((body, i) => ({ body, receiptHandle: `rh-${i}` }))
  return {
    acked,
    consumer: {
      receive: vi.fn(async () => messages),
      ack: vi.fn(async (rh: string) => void acked.push(rh)),
    },
  }
}

const msg = (topic: string): string =>
  JSON.stringify({ id: 'obx_1', topic, tenantId: 't-alpha', payload: {} } satisfies OutboxMessage)

describe('consumeEventsOnce', () => {
  it('handles each message then acks it', async () => {
    const { consumer, acked } = fakeConsumer([msg('request.submitted'), msg('request.expired')])
    const handle = vi.fn(async () => {})
    const r = await consumeEventsOnce({ consumer, handle })
    expect(handle).toHaveBeenCalledTimes(2)
    expect(r).toEqual({ received: 2, handled: 2, failed: 0 })
    expect(acked).toEqual(['rh-0', 'rh-1'])
  })

  it('leaves a message unacked when its handler throws', async () => {
    const { consumer, acked } = fakeConsumer([msg('request.submitted')])
    const handle = vi.fn(async () => {
      throw new Error('db down')
    })
    const r = await consumeEventsOnce({
      consumer,
      handle,
      log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } as never,
    })
    expect(r).toEqual({ received: 1, handled: 0, failed: 1 })
    expect(acked).toEqual([])
  })

  it('drops (acks) an unparseable message', async () => {
    const { consumer, acked } = fakeConsumer(['{not json'])
    const handle = vi.fn(async () => {})
    const r = await consumeEventsOnce({
      consumer,
      handle,
      log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } as never,
    })
    expect(handle).not.toHaveBeenCalled()
    expect(acked).toEqual(['rh-0'])
    expect(r.handled).toBe(0)
  })
})
