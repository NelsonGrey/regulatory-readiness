# ADR 0004 — Audit trail and the transactional outbox

**Status:** Accepted (proposed baseline)
**Date:** August 30, 2026
**Related:** [engine/TECHNICAL_REQUIREMENTS.md](../engine/TECHNICAL_REQUIREMENTS.md) §20; [engine/detailed-design/05_IMPLEMENTATION_HANDOFF.md](../engine/detailed-design/05_IMPLEMENTATION_HANDOFF.md) §8–§9; [ADR 0001](0001-cloud-platform-aws.md)

## Context

Defined auditable actions must be recorded durably **before** the API returns success where transactional coupling is required (engine TRD §19), and background work (scan, OCR, extraction, export, notify) must not be lost if a worker or the queue hiccups. Both needs are met by writing to the database in the same transaction as the business change.

## Decision

- **`audit_event`** is an append-only table. Corrections are new events. Rows carry tenant, actor (type + id), action, target type/id, time, correlation id, before/after references (not full payloads), reason, and safe request metadata. No document text, claim values, tokens, or signed URLs.
- **`outbox`** is a table in the same database. A command handler writes the business rows, the `audit_event` row, and any `outbox` rows in **one transaction**. The API returns success only after commit.
- **A relay** (a `@rre/worker` job on a short EventBridge schedule, plus a NOTIFY-triggered fast path) reads unpublished `outbox` rows and publishes them to **EventBridge / SNS → SQS**. Publication is at-least-once; every consumer is idempotent and re-authorizes tenant/pack/object state.
- **Ordering** is per-aggregate via a monotonic sequence; consumers tolerate reordering across aggregates.
- **Tamper evidence** (hash chain or periodic signed digest) is deferred until the event model is stable; until then, marketing and UI must not call the log "immutable" or "tamper-proof".

## Consequences

- Every command path has a single "unit of work" wrapper that owns the transaction, the tenant `SET LOCAL`, the audit write, and the outbox write.
- The `outbox` table needs a retention/relay-lag alarm (engine TRD §20.3).
- Exactly-once delivery is explicitly **not** provided; idempotency keys on consumers are mandatory, not optional.
- Replaying the audit + outbox streams reconstructs "who changed what and why" for `AC-018`.
