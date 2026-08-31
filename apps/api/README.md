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
| `GET /api/v1/packs`, `GET /api/v1/packs/:packKey` | Installed control packs + validation status (registry-backed, ADR 0005) |
| `POST /api/v1/entities` | ENT-001 — create a regulated entity; records scope facts, pack + snapshot, per-control applicability, actor, time, and a reproducibility hash (AC-003) |
| `GET /api/v1/entities/:id/matrix` | MAT-001 — per-control applicability + readiness, approved value, entity status, honest counts (AC-004) |
| `POST /api/v1/entities/:id/controls/:controlKey/claims` | Assert a claim → `PENDING_REVIEW` |
| `POST /api/v1/claims/:claimId/decisions` | Approve / reject (reason required) / request clarification; approval supersedes the prior approved claim (AC-010) |
| `GET /api/v1/entities/:id/review-queue` | Pending claims for an entity |
| `GET /api/v1/audit-events` | Tenant audit trail, newest first (AUD-001, AC-018) |
| `POST /api/v1/entities/:id/requests` | REQ-001 — mint a scoped evidence request; returns the plaintext token **once** + `contributorPath` |
| `GET /api/v1/entities/:id/requests`, `GET /api/v1/requests/:requestId` | Request list / detail (items, grant prefixes + uses, submission history — never the token) |
| `POST /api/v1/requests/:requestId/send`, `POST /api/v1/requests/:requestId/revoke` | Send / revoke a request's access token |
| `POST /api/v1/requests/:requestId/resend` | Revoke live grants, mint a fresh link (returned once), reactivate a lapsed request (`DRAFT`/`EXPIRED`/`CANCELLED` → `SENT`) |
| `POST /api/v1/submissions/:submissionId/items/:itemId/accept` | Pull one contributor response into the review queue as a `SUPPLIER_ASSERTION` claim |
| `POST /api/v1/entities/:id/readiness-snapshots` | Freeze current readiness into an append-only snapshot (canonical document + `sha256:` content hash) |
| `GET /api/v1/entities/:id/readiness-snapshots`, `GET /api/v1/readiness-snapshots/:id` | Snapshot list / full frozen document |
| `GET /api/v1/readiness-snapshots/:id/export.json`, `.../export.csv` | Canonical JSON / control-matrix CSV, generated only from the frozen snapshot, served as an attachment |
| `GET /api/v1/notifications` (`?unread=1`, `?limit=`), `GET /api/v1/notifications/unread-count` | The tenant's notification feed (written by the worker's events consumer) |
| `POST /api/v1/notifications/:id/read`, `POST /api/v1/notifications/read-all` | Mark read — the only mutation on a notification |
| `GET /contributor/v1/requests/:token` | SUP-001 — the requested controls + entity name only (plus any saved draft); no tenant header |
| `PUT /contributor/v1/requests/:token/draft` | SUP-002 — save in-progress answers (mutable, one draft per request; cleared on submit) |
| `POST /contributor/v1/requests/:token/submit` | SUP-003 — no-account submission (availability state per item); writes an immutable version, returns a receipt |
| `GET /contributor/v1/requests/:token/receipt` | SUP-006 — receipt for the latest submission |

Auth is a dev stand-in: `x-tenant-id` (required on `/api/v1`) and optional
`x-actor` headers map to an `AuthContext`. The `/contributor/v1` portal takes no
tenant header — the 192-bit token (stored hashed only, resolved by an 8-char
prefix before the tenant is known) is the principal; every portal response
carries `referrer-policy: no-referrer`, `cache-control: no-store`, and
`x-robots-tag: noindex, nofollow`. Production replaces the operator stand-in with
an OIDC session and a Postgres `SET LOCAL app.tenant_id` per transaction
(ADR 0002/0003).

## Persistence

- `pnpm --filter @rre/api migrate` (or `pnpm db:migrate`) runs `migrations/*.sql`
  forward-only, as the owner (`DATABASE_URL`).
- The API connects as the non-superuser `rre_app` role (`APP_DATABASE_URL`), so
  the RLS policies are enforced. Every read/write runs inside a transaction with
  `app.tenant_id` set (`withTenant` in `src/db/pool.ts`).
- With no `DATABASE_URL`, the API falls back to the in-memory unit of work; the
  contributor token grant is resolved from the same in-memory store.
- `src/repositories/entities.pg.test.ts` is an integration test (RLS scoping for
  entities, claims, requests, and submissions; append-only enforcement; grant
  resolution by hash): it runs when `TEST_DATABASE_URL` is set and skips
  otherwise.

`build` bundles with tsup (workspace packages are inlined). A container image and
the ECS Fargate service are defined later in `infra/`.
