import { describe, expect, it, vi } from 'vitest'
import { SendMessageCommand } from '@aws-sdk/client-sqs'
import { createSqsPublisher } from './sqs.js'

describe('createSqsPublisher', () => {
  it('sends the whole message as the body with topic/tenant attributes', async () => {
    const pub = createSqsPublisher({ region: 'eu-west-1', queueUrl: 'https://sqs.example/q' })
    const send = vi.spyOn(pub.client, 'send').mockResolvedValue(undefined as never)

    await pub.publish({
      id: 'obx_1',
      topic: 'entity.readiness_evaluated',
      tenantId: 't-alpha',
      payload: { entityId: 'ent_1' },
    })

    expect(send).toHaveBeenCalledOnce()
    const cmd = send.mock.calls[0]![0] as SendMessageCommand
    expect(cmd).toBeInstanceOf(SendMessageCommand)
    expect(cmd.input.QueueUrl).toBe('https://sqs.example/q')
    expect(JSON.parse(cmd.input.MessageBody ?? '')).toEqual({
      id: 'obx_1',
      topic: 'entity.readiness_evaluated',
      tenantId: 't-alpha',
      payload: { entityId: 'ent_1' },
    })
    expect(cmd.input.MessageAttributes?.topic?.StringValue).toBe('entity.readiness_evaluated')
    expect(cmd.input.MessageAttributes?.tenantId?.StringValue).toBe('t-alpha')
    expect(cmd.input.MessageAttributes?.outboxId?.StringValue).toBe('obx_1')
  })
})
