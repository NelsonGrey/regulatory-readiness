# @rre/domain

Entities, state machines, and policies. Framework-light — no HTTP, database, or
cloud imports, so it stays fast to test and easy to reason about.

Current:

- `readiness.ts` — the `ReadinessState` / `EntityStatus` vocabulary and
  `deriveEntityStatus()`, the deterministic entity-status derivation from engine
  BRD §10.2.

To follow: control/claim/request/document/conflict/snapshot state machines, unit
normalization, applicability expression types.
