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

## Request expiry sweep (migration 0008)

`sweepExpiredRequests()` moves evidence requests whose access links have all
lapsed — no grant that is both unrevoked and unexpired — from a non-terminal
status (`DRAFT` / `SENT` / `IN_PROGRESS`) to `EXPIRED`, and writes the
`request.expired` audit event and outbox notification for each in the same
transaction. The cross-tenant transition lives in a `SECURITY DEFINER` function
(`expire_lapsed_requests`); the worker connects as `rre_app` (not `rre_relay`)
and only holds `EXECUTE` on that one function. Idempotent and safe to run from
multiple instances (`FOR UPDATE SKIP LOCKED`).

Enabled when `APP_DATABASE_URL` is set; runs on an `EXPIRY_SWEEP_INTERVAL_MS`
timer (default 60s).

## Queue handlers

`src/handlers.ts` — one stub per SQS queue (scan-result, OCR, extraction, export,
notify). SQS long-polling + dispatch lands in a later slice.
