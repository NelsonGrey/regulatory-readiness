# Build status — retrospective after slice 27

A checkpoint for the founder. What exists, what is deliberately a stand-in, and
what a real launch still needs. The per-slice log lives in the root `README.md`;
this is the shape of the whole.

## What shipped

### The engine (regulation-agnostic core)

The full evidence-readiness loop, driven entirely by control-pack data:

- **Classify** — pack applicability rules → per-control result, a snapshot key, a
  reproducibility hash (`ENT-001` / `AC-003`).
- **Gather** — a no-account contributor request loop (hashed expiring tokens,
  drafts, receipts); document intake (quarantine → scan stub → promote, access
  classes); AI/OCR extraction proposals behind a human accept gate.
- **Assess** — readiness derivation per control (`EVIDENCED` / `SELF_ATTESTED` /
  `MISSING` / `CONFLICTING` / `STALE` / …) rolling up to an entity status
  (`EVIDENCE_READY` / `REVIEW_NEEDED` / `BLOCKED` / `OUTDATED_SNAPSHOT`).
- **Freeze** — an immutable readiness snapshot + a canonical JSON/CSV export with
  guarded verdict language (never "compliant" / "certified").
- **Change** — re-evaluate on corrected facts, applicability overrides (append-only
  except `revoked_at`), and a "who is on a stale control snapshot" impact view.
- **Retain / delete** — a full data-export bundle and a double-confirmed
  delete-then-purge that clears every tenant row (append-only tables included via
  `purge_tenant()`), keeping only a completion tombstone.

Proven regulation-agnostic: a second pack (**EU Batteries Regulation** battery
passport — different facts, controls, applicability) is discovered, validated, and
served through the same endpoints with **zero engine code change**.

### The SaaS wrapper

- **Tenancy** — users, workspaces, memberships (`owner` / `admin` / `member`),
  invites. Every workspace-scoped route is behind one membership pre-handler;
  owner-only capabilities checked per route.
- **Identity** — a `PrincipalVerifier` seam. `jwtVerifier` accepts RS256 bearer
  tokens from any OIDC provider (Clerk, WorkOS, Auth0, …), verified against a JWKS
  with `node:crypto`, no SDK.
- **Billing** — a `subscription` per workspace, a 14-day trial, plan-gated limits
  (entities / seats) enforced at the trust boundary with `402`, a `BillingProvider`
  seam + `noop` default, a real Stripe adapter (plain HTTP, no SDK) + webhook
  signature verification.
- **Email** — an `EmailSender` seam (`console` default, `resend` adapter). Invites
  and contributor request links are actually delivered, best-effort.
- **Operator web** — sign-in, workspace switcher, team management, a 3-step
  onboarding wizard, a dashboard (entity list + status roll-up), billing page,
  data-export/delete page.
- **Pack governance** — `draft` → `active` as governed data: two named reviewers
  against a pinned checksum, an activation row, drift detection, a platform-admin
  API + `/w/admin/packs` UI. `POST /entities` can be gated to activated packs.

### Non-functional

- Postgres row-level security (`FORCE`), `SET LOCAL app.tenant_id` per
  transaction, a non-superuser app role with append-only `REVOKE`s.
- A transactional outbox → relay → SQS; a worker (events consumer, expiry sweep).
- One unit of work: business write + audit event + outbox commit atomically.
- 320 tests (unit + web + HTTP UAT + skipped-unless-`TEST_DATABASE_URL` pg
  integration). `typecheck` / `lint` / `lint:copy` / `test` / `build` green on
  every commit to `develop`; CI runs the pg suite against `postgres:16`.

## Deliberate stand-ins (swap-in points, not rewrites)

| Area | Today | Swap |
| --- | --- | --- |
| Identity | `x-user-email` header (dev) | set `AUTH_JWT_ISSUER` + `AUTH_JWKS_URI` — the `jwtVerifier` is real |
| Membership hook | `DEV_AUTH=1` synthesises an owner | leave it off — production refuses a request with no membership |
| Billing provider | `noop` (checkout returns to the page) | set `STRIPE_SECRET_KEY` + price IDs |
| Email | `console` (logs the message) | set `RESEND_API_KEY` + `EMAIL_FROM` |
| Malware scan | `scanBytes` stub (size / type / EICAR) | a real scanner (ClamAV, S3 scanning) behind the same call |
| Object storage | in-memory local store | `createS3ObjectStore` exists; only local is exercised in CI |
| Platform admin | `PLATFORM_ADMIN_EMAILS` allowlist | an IdP group / org role |
| Pack source | files in `packs/` loaded at boot | governance state is already data; pack *bundles* are still a deploy |

## What a real launch still needs

- **Wire an actual vendor** for identity (Clerk vs WorkOS is a founder decision),
  Stripe (account + price IDs), Resend (domain).
- **A real malware scanner** in the document pipeline.
- **Observability** — the logger is there; metrics / tracing / alerting and deep
  health checks are not.
- **Rate limiting / abuse protection** on the public contributor portal and
  uploads; per-workspace quotas beyond entities/seats (storage, requests).
- **Legal** — ToS, Privacy, DPA + subprocessor list (data export + delete, the
  hard GDPR parts, are built).
- **Pack authoring at scale** — each regulation × jurisdiction is expert content
  the founder owns and must keep current; the engine makes it leverage, not free.
- **Infra** — pick the cheap path (Fly/Render + Neon + Cloudflare R2) until a
  design partner's security review forces a move to AWS/GCP proper.

## The honest summary

The **domain engine** is feature-complete and demonstrably vertical-neutral. The
**SaaS wrapper** is complete in shape — every external dependency is an env-gated
adapter, not a TODO. What's left before charging money is vendor wiring, a real
scanner, operational hardening, and legal — plus the ongoing, founder-owned work
of authoring and maintaining control packs.
