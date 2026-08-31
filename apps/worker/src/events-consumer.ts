import type { Logger } from '@rre/observability'
import type { OutboxMessage, SqsConsumer } from './sqs.js'

export interface ConsumeDeps {
  consumer: Pick<SqsConsumer, 'receive' | 'ack'>
  handle: (event: OutboxMessage) => Promise<unknown>
  max?: number
  log?: Logger
}

export interface ConsumeResult {
  received: number
  handled: number
  failed: number
}

/**
 * Drain one batch from the events queue. A message is deleted only after its
 * handler resolves; a failing message is left for SQS redelivery (handlers are
 * idempotent). A body that will not parse is dropped with a warning — retrying
 * it forever helps no one.
 */
export async function consumeEventsOnce({
  consumer,
  handle,
  max = 10,
  log,
}: ConsumeDeps): Promise<ConsumeResult> {
  const messages = await consumer.receive(max)
  let handled = 0
  let failed = 0

  for (const m of messages) {
    let event: OutboxMessage
    try {
      event = JSON.parse(m.body) as OutboxMessage
    } catch {
      log?.warn('events consumer: unparseable message dropped', { receiptHandle: m.receiptHandle })
      await consumer.ack(m.receiptHandle)
      continue
    }

    try {
      await handle(event)
      await consumer.ack(m.receiptHandle)
      handled++
    } catch (err) {
      failed++
      log?.error('events consumer: handler failed, leaving message for redelivery', {
        topic: event.topic,
        err: String(err),
      })
    }
  }

  return { received: messages.length, handled, failed }
}
