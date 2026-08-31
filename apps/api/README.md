# @rre/api

The modular-monolith HTTP API (Fastify). One route module per concern; every
route validates tenant, pack, role, and object ownership at the trust boundary
(engine Handoff §8). Background work is published through a transactional outbox
to SQS; `@rre/worker` consumes it.

```bash
pnpm --filter @rre/api dev     # tsx watch, http://localhost:3000
DEV_AUTH=1 pnpm --filter @rre/api dev   # trust x-user-email as an owner (no membership needed)
```

## Auth

Every workspace-scoped route (all of `/api/v1/*` except the control plane below
and `/packs`) is behind one `preHandler` that resolves the signed-in person and
their `membership` role in the `x-tenant-id` workspace. No identity → 401; not a
member → 403. Owner-only capabilities (deleting the workspace) are checked per
route. Set `DEV_AUTH=1` to skip the membership lookup and treat any caller as an
`owner`.

Identity is resolved by a `PrincipalVerifier`: set `AUTH_JWT_ISSUER` +
`AUTH_JWKS_URI` (and optionally `AUTH_JWT_AUDIENCE`) to accept RS256 bearer
tokens from an OIDC provider (Clerk, WorkOS, Auth0, …); otherwise the dev
stand-in trusts the `x-user-email` header.

## External integrations (all optional, all env-gated)

| Env | Effect |
| --- | --- |
| `AUTH_JWT_ISSUER` + `AUTH_JWKS_URI` | Verify real OIDC bearer tokens instead of the `x-user-email` stand-in |
| `STRIPE_SECRET_KEY` (+ `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_GROWTH`) | Real Stripe checkout / portal instead of the no-op provider |
| `STRIPE_WEBHOOK_SECRET` | Enables `POST /webhooks/stripe` (503s without it) |
| `RESEND_API_KEY` + `EMAIL_FROM` | Send invite emails via Resend instead of logging them |
| `APP_BASE_URL` | Absolute base for links in emails and billing redirects |

## Routes

| Method + path | Purpose |
| --- | --- |
| `GET /health` | Liveness |
| `POST /api/v1/sign-up` | First sign-in — creates the person and their first workspace (they become `owner`); `x-user-email` is the signed-in identity (TRD §3) |
| `GET /api/v1/workspaces`, `POST /api/v1/workspaces` | The caller's workspaces + role / spin up another |
| `GET /api/v1/members` | Roster for the `x-tenant-id` workspace (+ pending invites for owner/admin) |
| `POST /api/v1/members/invites`, `GET …`, `POST /api/v1/members/invites/:id/revoke` | Invite a teammate (owner/admin, never an owner; token returned once) / list / withdraw |
| `POST /api/v1/invites/accept` | Join a workspace with your own verified email (mismatch / expired / revoked / used all refused) |
| `PATCH /api/v1/members/:userId`, `DELETE /api/v1/members/:userId` | Change a member's role / remove (or leave) — the last owner is protected |
| `GET /api/v1/billing` | Current plan, status, trial/renewal date, plan limits, and live usage (entities, seats) |
| `POST /api/v1/billing/checkout`, `POST /api/v1/billing/portal` | Owner-only — a provider redirect URL to upgrade / manage the subscription |
| `POST /webhooks/stripe` | Raw body, signature-verified, no session — moves `plan` / `status` / `current_period_end` |
| `GET /api/v1/packs`, `GET /api/v1/packs/:packKey` | Installed control packs + validation status (registry-backed, ADR 0005) |
| `POST /api/v1/entities` | ENT-001 — create a regulated entity; records scope facts, pack + snapshot, per-control applicability, actor, time, and a reproducibility hash (AC-003) |
| `GET /api/v1/entities` | Every entity in the workspace with its current snapshot (newest first) |
| `GET /api/v1/entities/:id/matrix` | MAT-001 — per-control applicability + readiness, approved value, entity status, honest counts (AC-004) |
| `POST /api/v1/entities/:id/re-evaluate` | Re-run applicability (optional corrected `facts`) → new evaluation version + a diff; claims and evidence are kept (AC-008) |
| `GET /api/v1/packs/:packKey/impact` | Entities on an older control snapshot than the installed pack — added / removed control keys and orphaned approved claims per entity; adopting is a re-evaluate (AC-009) |
| `POST /api/v1/entities/:id/controls/:controlKey/claims` | Assert a claim → `PENDING_REVIEW` |
| `POST /api/v1/claims/:claimId/decisions` | Approve / reject (reason required) / request clarification; approval supersedes the prior approved claim (AC-010) |
| `GET /api/v1/entities/:id/review-queue` | Pending claims for an entity |
| `GET /api/v1/audit-events` | Tenant audit trail, newest first (AUD-001, AC-018) |
| `POST /api/v1/entities/:id/requests` | REQ-001 — mint a scoped evidence request; returns the plaintext token **once** + `contributorPath`; an optional `recipientEmail` also emails the portal link |
| `GET /api/v1/entities/:id/requests`, `GET /api/v1/requests/:requestId` | Request list / detail (items, grant prefixes + uses, submission history — never the token) |
| `POST /api/v1/requests/:requestId/send`, `POST /api/v1/requests/:requestId/revoke` | Send / revoke a request's access token |
| `POST /api/v1/requests/:requestId/resend` | Revoke live grants, mint a fresh link (returned once), reactivate a lapsed request (`DRAFT`/`EXPIRED`/`CANCELLED` → `SENT`) |
| `POST /api/v1/submissions/:submissionId/items/:itemId/accept` | Pull one contributor response into the review queue as a `SUPPLIER_ASSERTION` claim |
| `POST /api/v1/entities/:id/readiness-snapshots` | Freeze current readiness into an append-only snapshot (canonical document + `sha256:` content hash) |
| `GET /api/v1/entities/:id/readiness-snapshots`, `GET /api/v1/readiness-snapshots/:id` | Snapshot list / full frozen document |
| `GET /api/v1/readiness-snapshots/:id/export.json`, `.../export.csv` | Canonical JSON / control-matrix CSV, generated only from the frozen snapshot, served as an attachment |
| `GET /api/v1/notifications` (`?unread=1`, `?limit=`), `GET /api/v1/notifications/unread-count` | The tenant's notification feed (written by the worker's events consumer) |
| `POST /api/v1/notifications/:id/read`, `POST /api/v1/notifications/read-all` | Mark read — the only mutation on a notification |
| `POST /api/v1/documents` | Start an upload — media-type + size check, returns a presigned/relative PUT URL |
| `POST /api/v1/documents/:id/finalize` | Hash + scan the uploaded bytes, promote a clean object to originals, set `AVAILABLE` / `REJECTED_MALWARE` / `UNSUPPORTED` |
| `GET /api/v1/documents` (`?entityId=`), `GET /api/v1/documents/:id` | Document list / detail (with associations) |
| `GET /api/v1/documents/:id/download` | A download URL — only when `AVAILABLE` |
| `POST /api/v1/documents/:id/associations` | Link a document to an entity / request / claim |
| `POST /api/v1/claims/:claimId/evidence`, `GET /api/v1/claims/:claimId/evidence` | Pin a spot in an `AVAILABLE` document to a claim — a `SUPPORTS` link is what turns `SELF_ATTESTED` into `EVIDENCED` |
| `POST /api/v1/entities/:id/documents/:documentId/extractions`, `GET …` | Run AI/OCR extraction over a linked `AVAILABLE` document / list runs |
| `GET /api/v1/extractions/:runId` | The run + its proposals (value, unit, confidence, source quote, validation) |
| `POST /api/v1/extraction-proposals/:id/accept` | The human gate — creates an `EXTRACTION_ACCEPTED` claim + the evidence link; blocked with no location or a failing validator |
| `POST /api/v1/extraction-proposals/:id/reject` | Reject a proposal (a reason is required) |
| `POST /api/v1/entities/:id/controls/:controlKey/applicability-override` | Record a reasoned applicability override (never changes the snapshot) |
| `GET /api/v1/entities/:id/applicability-overrides`, `POST /api/v1/applicability-overrides/:id/revoke` | List / withdraw overrides |
| `GET /api/v1/export/tenant` | A JSON attachment: per-table row counts + a full dump of every record held for the tenant (audited `tenant.exported`) |
| `POST /api/v1/deletion-requests`, `GET /api/v1/deletion-requests` | Record a tenant-deletion request (the `confirmation` must equal the workspace id) with an impact preview / list requests |
| `POST /api/v1/deletion-requests/:id/execute` | Re-check the confirmation, then purge every tenant row + object in one transaction, keeping a `COMPLETED` tombstone and a single `deletion.completed` audit row (TRD §21) |
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
- Document intake uses S3 (`createS3ObjectStore`) only when `S3_BUCKET_ORIGINALS`
  and `S3_BUCKET_QUARANTINE` are both set; otherwise an in-memory `local` store
  keeps the bytes and the API serves them from `/api/v1/documents/content/*`.
  Either way, the upload is hashed and scanned at finalize before it is promoted
  out of quarantine.
- `src/repositories/entities.pg.test.ts` is an integration test (RLS scoping for
  entities, claims, requests, and submissions; append-only enforcement; grant
  resolution by hash): it runs when `TEST_DATABASE_URL` is set and skips
  otherwise.

`build` bundles with tsup (workspace packages are inlined). A container image and
the ECS Fargate service are defined later in `infra/`.
