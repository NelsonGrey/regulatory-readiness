import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'

export interface SqsPublisherConfig {
  region: string
  /** Override for LocalStack; omit in production. */
  endpoint?: string
  queueUrl: string
  credentials?: { accessKeyId: string; secretAccessKey: string }
}

export interface OutboxMessage {
  id: string
  topic: string
  tenantId: string
  payload: unknown
}

export interface SqsPublisher {
  client: SQSClient
  publish(msg: OutboxMessage): Promise<void>
}

/**
 * SQS publisher for relayed outbox messages (engine ARCHITECTURE_AWS §4).
 * The body is the whole message; `topic` / `tenantId` / `outboxId` are also
 * message attributes so consumers can filter without parsing the body.
 */
export function createSqsPublisher(cfg: SqsPublisherConfig): SqsPublisher {
  const client = new SQSClient({
    region: cfg.region,
    ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
    ...(cfg.credentials ? { credentials: cfg.credentials } : {}),
  })

  return {
    client,
    async publish(msg) {
      await client.send(
        new SendMessageCommand({
          QueueUrl: cfg.queueUrl,
          MessageBody: JSON.stringify(msg),
          MessageAttributes: {
            topic: { DataType: 'String', StringValue: msg.topic },
            tenantId: { DataType: 'String', StringValue: msg.tenantId },
            outboxId: { DataType: 'String', StringValue: msg.id },
          },
        }),
      )
    },
  }
}
