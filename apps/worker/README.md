# @rre/worker

Queue consumers, scheduled jobs, and the **outbox relay**.

```bash
pnpm --filter @rre/worker dev
```

## Outbox relay (ADR 0004)

`relayOnce()` drains a batch of unpublished `outbox` rows and publishes each to
SQS:

- rows are locked with `FOR UPDATE SKIP LOCKED`, so multiple relay instances can
  run concurrently;
- a successful publish sets `published_at`; a failure bumps `attempts` and the
  row is retried on the next pass — publication is **at-least-once**, so
  consumers must be idempotent;
- the relay connects as `rre_relay` (BYPASSRLS, migration 0004) to see every
  tenant's rows, and can only touch the `outbox` bookkeeping columns.

Enabled when `RELAY_DATABASE_URL` and `SQS_EVENTS_QUEUE_URL` are set; runs on a
`RELAY_INTERVAL_MS` timer (default 2s) in the worker process. In production this
becomes an EventBridge-Scheduler-driven task.

## Queue handlers

`src/handlers.ts` — one stub per SQS queue (scan-result, OCR, extraction, export,
notify). SQS long-polling + dispatch lands in a later slice.
