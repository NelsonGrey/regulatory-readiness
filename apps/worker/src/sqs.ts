import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs'

export interface SqsPublisherConfig {
  region: string
  /** Override for LocalStack; omit in production. */
  endpoint?: string
  queueUrl: string
  credentials?: { accessKeyId: string; secretAccessKey: string }
}

/** Shared client construction for the publisher and the consumer. */
export function makeSqsClient(cfg: Omit<SqsPublisherConfig, 'queueUrl'>): SQSClient {
  return new SQSClient({
    region: cfg.region,
    ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
    ...(cfg.credentials ? { credentials: cfg.credentials } : {}),
  })
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
  const client = makeSqsClient(cfg)

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

export interface SqsConsumer {
  client: SQSClient
  /** Fetch up to `max` messages (default 10) with `waitSeconds` long-poll (default 0). */
  receive(
    max?: number,
    waitSeconds?: number,
  ): Promise<Array<{ body: string; receiptHandle: string }>>
  ack(receiptHandle: string): Promise<void>
}

export function createSqsConsumer(cfg: SqsPublisherConfig): SqsConsumer {
  const client = makeSqsClient(cfg)
  return {
    client,
    async receive(max = 10, waitSeconds = 0) {
      const res = await client.send(
        new ReceiveMessageCommand({
          QueueUrl: cfg.queueUrl,
          MaxNumberOfMessages: max,
          WaitTimeSeconds: waitSeconds,
        }),
      )
      return (res.Messages ?? []).map((m) => ({
        body: m.Body ?? '',
        receiptHandle: m.ReceiptHandle ?? '',
      }))
    },
    async ack(receiptHandle) {
      await client.send(
        new DeleteMessageCommand({ QueueUrl: cfg.queueUrl, ReceiptHandle: receiptHandle }),
      )
    },
  }
}
