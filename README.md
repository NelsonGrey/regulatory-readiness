# Regulatory Readiness Engine

**Status:** Proposed / discovery
**Baseline date:** August 30, 2026
**Working product name:** Regulatory Readiness Engine (placeholder; not trademark-cleared)

A multi-tenant platform that helps small and mid-size organizations assemble, validate, version, and export the evidence needed to prepare for a specific regulation — keeping missing, conflicting, stale, and unreviewed information visible, and never claiming legal compliance, certification, or authority approval.

The platform is **one reusable engine** plus a library of **control packs**. Each pack encodes one regulation as a dated, versioned catalog of discrete controls, with applicability rules, evidence expectations, validators, and export profiles. Adding a regulation means adding a pack — mostly data and declared rules, not a code fork.

## Start here

| Document | Purpose |
| --- | --- |
| [docs/ENGINE_CONCEPT.md](docs/ENGINE_CONCEPT.md) | Platform framing: engine primitives, the control-pack contract, the pack portfolio and sequencing, the fit test, next steps |
| [docs/engine/README.md](docs/engine/README.md) | Vertical-neutral requirements and design — start of the engine spec |
| [docs/engine/BUSINESS_REQUIREMENTS.md](docs/engine/BUSINESS_REQUIREMENTS.md) | Customers, personas, jobs, `BR-*`, readiness policy, commercial model, MVP acceptance |
| [docs/engine/TECHNICAL_REQUIREMENTS.md](docs/engine/TECHNICAL_REQUIREMENTS.md) | Architecture, domain model, control/version model, `TR-*`, extraction, APIs, nonfunctional targets, `FSG-*` |
| [docs/engine/detailed-design/README.md](docs/engine/detailed-design/README.md) | Personas, IA, screens, states, responsive/accessibility contracts, traceability, `AC-*`, build sequence |
| [docs/ARCHITECTURE_AWS.md](docs/ARCHITECTURE_AWS.md) | AWS reference architecture: region and account topology, service mapping per engine primitive, ingestion/malware pipeline, nonfunctional mapping, cost anchors, open AWS decisions |
| [docs/adr/](docs/adr/) | Decision records: 0001 AWS, 0002 tenancy (pooled + RLS), 0003 authorization, 0004 audit + outbox, 0005 control-pack packaging |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local-first dev setup, workspace layout, AWS free-tier reality and cost-control simplifications |
| [docs/packs/README.md](docs/packs/README.md) | Control-pack registry and the per-pack artifact contract |
| [docs/packs/espr-dpp-battery/](docs/packs/espr-dpp-battery/) | Origin design, preserved as the first control pack (EU battery passport) |

## Current state

Full specification, a buildable monorepo, and the first slice of real engine code. `typecheck` / `lint` / `test` (65) / `build` / `format` all green.

- **Spec** — engine spec split from the origin battery package into [`docs/engine/`](docs/engine/) + [`docs/packs/espr-dpp-battery/`](docs/packs/espr-dpp-battery/) (see [ENGINE_CONCEPT.md §9](docs/ENGINE_CONCEPT.md)); pack #1 spec in [`docs/packs/eaa-accessibility/`](docs/packs/eaa-accessibility/); ADRs 0001–0005 in [`docs/adr/`](docs/adr/).
- **Scaffold** — pnpm/TypeScript monorepo (`apps/{api,worker,web}`, `packages/*`, `packs/`, `infra/`) with a local Docker dev stack (Postgres + LocalStack).
- **Slice 1 so far**
  - `@rre/contracts` — pack-artifact + API request schemas (Zod).
  - `packs/eaa-accessibility/` — a `draft` bundle (20 controls, 16 applicability rules, 5 known-outcome vectors) that loads + validates.
  - `@rre/control-catalog` — `loadPack` / `validatePack` / `loadInstalledPacks`, `validateEntityFacts`, and the deterministic applicability evaluator.
  - `@rre/domain` — applicability summary, canonical-JSON, entity types, and the deterministic **readiness derivation** (`deriveControlReadiness` per control → `readinessForEntity` → `EVIDENCE_READY` / `REVIEW_NEEDED` / `BLOCKED`); browser-safe.
  - `@rre/db` — shared Postgres pool, `withTenant` (RLS `SET LOCAL`), forward-only migration runner.
  - `@rre/api` — `GET /packs` + `GET /packs/:packKey`; `POST /entities` (immutable hashed scope evaluation); `GET /entities/:id/matrix` — now with **readiness per control** (`EVIDENCED`/`MISSING`/`PENDING_REVIEW`/`CONFLICTING`/…), the approved claim value, and the entity's overall status; **`POST /entities/:id/controls/:controlKey/claims`** (assert a claim → `PENDING_REVIEW`), **`POST /claims/:claimId/decisions`** (`APPROVED`/`REJECTED`/`CLARIFICATION_REQUESTED` — a reason is required to reject; approval supersedes the prior approved claim, history preserved), **`GET /entities/:id/review-queue`**, **`GET /audit-events`** (AUD-001). Tenant via `x-tenant-id`; cross-tenant reads empty/404.
  - **Persistence** — migrations `0001` (entities + scope evaluations, RLS `FORCE`d), `0002` (`rre_app` runtime role), `0003` (append-only `audit_event` + transactional `outbox`), `0004` (`rre_relay` BYPASSRLS role), `0005` (`claim` — value immutable, only `status`/`supersedes` writable by `rre_app` — + append-only `review_decision`); `pnpm db:migrate`.
  - **Unit of work** (ADR 0004) — `pgUnitOfWork` / `inMemoryUnitOfWork`: business writes + the audit event + outbox messages commit in **one tenant-scoped transaction** or not at all.
  - **Outbox relay** — `@rre/worker` drains unpublished `outbox` rows (`FOR UPDATE SKIP LOCKED`) and publishes them to SQS (`@aws-sdk/client-sqs`, LocalStack in dev); success sets `published_at`, failure bumps `attempts` and retries. At-least-once; verified end-to-end against LocalStack.
  - **Operator web** — `@rre/web` (React + React Router): a control-pack list, **`ENT-001`** create screen whose scope-fact form is generated from `GET /api/v1/packs/:packKey`, and **`MAT-001`** matrix screen — entity context, an honest denominator ("N of M controls required by this snapshot", never a %), and a filterable per-control table. Dev proxy `/api → :3000`; verified serving + proxying live.
  - **Testing** — 100 tests / 25 projects. Unit: readiness derivation (every precedence branch + entity-status roll-up), claim assert/approve/reject/supersede + reason enforcement, uow atomicity + audit pagination, applicability evaluator, pack validation, capability matrix, SQS command shape, web screens. Integration (Postgres, `TEST_DATABASE_URL`, else skipped): RLS hides cross-tenant rows (entities, audit, **claims, review decisions**) entirely; `WITH CHECK` rejects cross-tenant inserts; a failed uow rolls back the entity **and** its audit event; `audit_event` / `review_decision` `UPDATE`/`DELETE` denied to `rre_app`; `claim.value` is immutable to the app; the relay runs in its own disposable database. **UAT** (`apps/api/src/acceptance/`): `AC-003`, `AC-004`, `AC-010` (human claim decision — approve evidences the control, reject needs a reason and keeps the record, entity is not evidence-ready while required controls are unmet), `AC-018`.

Next: wire the readiness column + claim/review UI into the web app, then the contributor request loop (`REQ-*` / `SUP-*`) — scoped no-account links.

## Build and develop

```bash
pnpm install
cp .env.example .env
pnpm infra:up          # local Postgres + LocalStack (zero AWS cost)
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Full setup, workspace layout, and AWS free-tier / cost-control guidance: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Proposed first pack

**EAA accessibility readiness.** Largest live market (EU Accessibility Act enforcement in force since June 2025), strong willingness to pay, soft mid-bottom competitive layer. The engine is built against this pack first; **CRA** (Cyber Resilience Act) is the proposed second pack, chosen to prove the pack abstraction on a very different domain.

## Platform

Build target is **AWS**, primary region **`eu-west-1`** (Ireland), managed services first, EU data residency. See [ADR 0001](docs/adr/0001-cloud-platform-aws.md) and the [AWS reference architecture](docs/ARCHITECTURE_AWS.md).
