# migrations

Forward-only database migrations (Postgres). Empty until Slice 1.

Rules (from [engine Implementation Handoff §9](../docs/engine/detailed-design/05_IMPLEMENTATION_HANDOFF.md)):

- Forward only. Each migration has forward validation, deployment ordering, a backfill plan, and a recovery strategy.
- All tenant-owned rows carry a non-null `tenant_id`; all pack-catalog rows carry a non-null `pack_key`.
- Immutable objects use append-only versions and supersession links, not in-place edits.
- Destructive column removal follows expand / migrate / contract across releases.
- Store instants in UTC.

Tooling (migration runner) is an open decision — pick before Slice 1.
