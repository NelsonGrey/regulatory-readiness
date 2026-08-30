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

Full specification, a buildable monorepo, and the first slice of real engine code. `typecheck` / `lint` / `test` (52) / `build` / `format` all green.

- **Spec** — engine spec split from the origin battery package into [`docs/engine/`](docs/engine/) + [`docs/packs/espr-dpp-battery/`](docs/packs/espr-dpp-battery/) (see [ENGINE_CONCEPT.md §9](docs/ENGINE_CONCEPT.md)); pack #1 spec in [`docs/packs/eaa-accessibility/`](docs/packs/eaa-accessibility/); ADRs 0001–0005 in [`docs/adr/`](docs/adr/).
- **Scaffold** — pnpm/TypeScript monorepo (`apps/{api,worker,web}`, `packages/*`, `packs/`, `infra/`) with a local Docker dev stack (Postgres + LocalStack).
- **Slice 1 so far**
  - `@rre/contracts` — pack-artifact + API request schemas (Zod).
  - `packs/eaa-accessibility/` — a `draft` bundle (20 controls, 16 applicability rules, 5 known-outcome vectors) that loads + validates.
  - `@rre/control-catalog` — `loadPack` / `validatePack` / `loadInstalledPacks`, `validateEntityFacts`, and the deterministic applicability evaluator.
  - `@rre/domain` — readiness-state derivation, canonical-JSON, entity types + applicability summary (browser-safe).
  - `@rre/api` — `GET /api/v1/packs` (registry-backed); **`POST /api/v1/entities`** creates a regulated entity with an immutable, hashed scope evaluation, and **`GET /api/v1/entities/:id/matrix`** returns the per-control applicability matrix + honest state counts. Tenant comes from `x-tenant-id` (dev stand-in for OIDC + RLS); cross-tenant reads 404.
  - **Persistence** — `migrations/0001_init.sql` (entities + scope evaluations, `tenant_id` + `pack_key`, RLS `FORCE`d) and `0002_app_role.sql` (non-superuser `rre_app` runtime role); a forward-only SQL migration runner (`pnpm db:migrate`); `PgEntityRepository` connects as `rre_app` inside a `SET LOCAL app.tenant_id` transaction. An integration test proves a raw cross-tenant `SELECT` returns zero rows and a cross-tenant `INSERT` is rejected by RLS `WITH CHECK` — it runs when `TEST_DATABASE_URL` is set (CI Postgres service) and skips cleanly otherwise. In-memory storage remains the no-DB fallback.
  - 52 tests across 12 projects.

Next: adversarial cross-**pack** isolation coverage (`AC-025` at the DB layer), the audit-event + outbox tables and the unit-of-work wrapper (ADR 0004), then the operator web shell and the `ENT-001` / `MAT-001` screens.

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
