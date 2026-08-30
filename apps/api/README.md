# @rre/api

The modular-monolith HTTP API (Fastify). One route module per concern; every
route validates tenant, pack, role, and object ownership at the trust boundary
(engine Handoff §8). Background work is published through a transactional outbox
to SQS; `@rre/worker` consumes it.

```bash
pnpm --filter @rre/api dev     # tsx watch, http://localhost:3000
```

## Routes

| Method + path | Purpose |
| --- | --- |
| `GET /health` | Liveness |
| `GET /api/v1/packs` | Installed control packs + validation status (registry-backed, ADR 0005) |
| `POST /api/v1/entities` | ENT-001 — create a regulated entity; records scope facts, pack + snapshot, per-control applicability, actor, time, and a reproducibility hash (AC-003) |
| `GET /api/v1/entities/:id/matrix` | MAT-001 — the per-control applicability matrix + honest state counts (AC-004) |

Auth is a dev stand-in: `x-tenant-id` (required) and optional `x-actor` headers
map to an `AuthContext`. Production replaces this with an OIDC session and a
Postgres `SET LOCAL app.tenant_id` per transaction (ADR 0002/0003).

## Persistence

- `pnpm --filter @rre/api migrate` (or `pnpm db:migrate`) runs `migrations/*.sql`
  forward-only, as the owner (`DATABASE_URL`).
- The API connects as the non-superuser `rre_app` role (`APP_DATABASE_URL`), so
  the RLS policies are enforced. Every read/write runs inside a transaction with
  `app.tenant_id` set (`withTenant` in `src/db/pool.ts`).
- With no `DATABASE_URL`, the API falls back to `InMemoryEntityRepository`.
- `src/repositories/entities.pg.test.ts` is an integration test: it runs when
  `TEST_DATABASE_URL` is set and skips otherwise.

`build` bundles with tsup (workspace packages are inlined). A container image and
the ECS Fargate service are defined later in `infra/`.
