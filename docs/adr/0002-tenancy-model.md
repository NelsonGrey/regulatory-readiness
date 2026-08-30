# ADR 0002 — Tenancy model: pooled, with row-level security

**Status:** Accepted (proposed baseline)
**Date:** August 30, 2026
**Related:** [engine/TECHNICAL_REQUIREMENTS.md](../engine/TECHNICAL_REQUIREMENTS.md) §3, §6, §15.3; [ENGINE_CONCEPT.md](../ENGINE_CONCEPT.md) §4

## Context

Every customer-owned row and object must be isolated by tenant, and — because one deployment hosts multiple regulations — also by control pack (engine principle 6–7). The team is small; per-tenant infrastructure is not affordable at MVP.

## Decision

- **Pooled model.** One PostgreSQL database, one schema. Every tenant-owned table carries a non-null `tenant_id`; every pack-catalog table carries a non-null `pack_key`. Composite unique constraints and foreign keys include `tenant_id` where applicable.
- **Row-level security (RLS)** is enabled on every tenant-owned table as defense in depth. The application sets `SET LOCAL app.tenant_id = …` per transaction; RLS policies restrict all reads/writes to that tenant. A separate migration role bypasses RLS; the application role does not.
- **Application-layer scoping is still mandatory** — every repository method takes an explicit tenant context; RLS is a backstop, not the primary control.
- **Object storage** keys are prefixed `t/<tenant_id>/…`; presigned URLs are minted only after an application authorization check.
- **A regulated entity belongs to exactly one pack.** Evaluations, matrices, snapshots, and exports never join catalog rows across packs.
- **Silo tenancy** (dedicated database/account per customer) is deferred; the account-per-environment structure in [ADR 0001](0001-cloud-platform-aws.md) is designed so account-per-tenant is a later extension.

## Consequences

- Cross-tenant and cross-pack access tests (adversarial identifier swapping) are a required part of CI and gate `FSG-003`.
- A noisy tenant can affect shared database resources; mitigations (connection limits, statement timeouts, per-tenant rate limits) are operational, not architectural, at MVP.
- Moving a customer to a silo later is a data-export/import exercise, not a code change.
- RLS adds a per-transaction `SET LOCAL`; the connection pool must not leak tenant context between transactions (enforced by always wrapping work in a tenant-scoped unit).
