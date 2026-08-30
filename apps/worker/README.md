# @rre/worker

Queue consumers and scheduled jobs. One handler per SQS queue (engine
ARCHITECTURE_AWS §4): malware-scan result, OCR, extraction, export generation,
notification delivery. EventBridge Scheduler drives reminders, staleness
recompute, and retention/deletion sweeps.

Every handler re-authorizes tenant/pack/object state and is idempotent
(engine Handoff §8).

```bash
pnpm --filter @rre/worker dev
```

Current: handler registry with stubs and a keep-alive loop. SQS long-polling
lands in Slice 3.
