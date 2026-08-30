# Development environment and cost control

**Principle: local-first.** The engine's core — domain model, pack loader, applicability evaluator, readiness state machine, conflict engine, export generation — needs no cloud. Build and test it locally at zero AWS cost. Touch real AWS only for integration testing in a shared `dev` account.

## Prerequisites

- Node 22 (`nvm use` reads `.nvmrc`)
- pnpm 9 (`corepack enable` then `corepack prepare pnpm@9.15.0 --activate`)
- Docker (for the local Postgres + LocalStack stack)

## First run

```bash
pnpm install
cp .env.example .env
pnpm infra:up          # postgres + localstack (S3/SQS/SES) — creates dev buckets/queues
pnpm db:migrate        # applies migrations/*.sql (as the DATABASE_URL owner)
pnpm typecheck
pnpm test              # unit + integration; set TEST_DATABASE_URL to include the Postgres RLS test
```

Then, in separate terminals:

```bash
pnpm dev:api           # Fastify on http://localhost:3000  (GET /health)
pnpm dev:worker        # queue consumer loop (stub)
pnpm dev:web           # Vite on http://localhost:5173
```

`pnpm infra:down` stops the stack; data persists in the `pgdata` volume until `docker compose down -v`.

### Database

- **`DATABASE_URL`** — owner connection, used only to run migrations.
- **`APP_DATABASE_URL`** — non-superuser `rre_app` connection the API uses at
  runtime, so row-level security is actually enforced (superusers bypass RLS).
  Migration `0002_app_role.sql` creates the role; it falls back to `DATABASE_URL`
  if unset.
- The Postgres RLS integration test runs only when **`TEST_DATABASE_URL`** points
  at a disposable database (`pnpm test` picks it up; without it the test skips).

## Workspace layout

| Path | Contents |
| --- | --- |
| `apps/api` | Modular monolith HTTP API (Fastify) |
| `apps/worker` | Queue consumers and scheduled jobs |
| `apps/web` | Operator, contributor, and reviewer React app (Vite) |
| `packages/domain` | Entities, state machines, policies; framework-light |
| `packages/control-catalog` | Pack loader, compiler, validator; pack-agnostic |
| `packages/contracts` | API/event/export schemas (Zod) |
| `packages/authorization` | Roles, capabilities, policy checks |
| `packages/ui` | Accessible shared components and tokens |
| `packages/test-fixtures` | Deterministic tenants/entities/docs/control cases |
| `packages/observability` | Structured logging, metrics, trace helpers |
| `packs/` | Runtime control-pack data bundles |
| `infra/` | AWS CDK (stub) + LocalStack init scripts |

## AWS free-tier reality

You can develop **mostly** within free tier plus a small monthly spend, not truly free. See [ARCHITECTURE_AWS.md §10](ARCHITECTURE_AWS.md) for production cost anchors.

**Covered for dev** (12-month or always-free): S3 (5 GB), CloudFront (1 TB egress, always free), RDS `db.t4g.micro` Single-AZ (750 h, 12 months), ALB (750 h, 12 months), Lambda/SQS/SNS/EventBridge (1 M/mo each), CloudWatch (10 metrics / 10 alarms / 5 GB logs), Cognito (free MAU allowance), Textract (~1,000 pages/mo for 3 months), 100 GB/mo data-out. New accounts (post-mid-2025) also get up to $200 credits over 6 months.

**Not covered — you pay from day one:** NAT Gateway (~$32/mo), ECS Fargate (~$9–15/mo per always-on task), Amazon Bedrock (per token), KMS ($1/key/mo), Secrets Manager ($0.40/secret/mo), GuardDuty/Malware Protection (per GB after 30-day trial).

### Shared `dev` account simplifications (documented as different from prod)

- **Skip NAT Gateway** — Fargate tasks in public subnets with egress-only security groups, or a `t4g.nano` NAT instance (~$3/mo).
- **ECS on one free-tier `t3.micro` EC2** (year 1) or a single combined api+worker Fargate task.
- **RDS `db.t4g.micro` Single-AZ** (free year 1; ~$12–15/mo after).
- **Only the S3 gateway VPC endpoint** (free); no interface endpoints in dev.
- **GuardDuty off** in dev; use a ClamAV container for scan-pipeline testing, enable GuardDuty only for a validation window.
- **SSM Parameter Store** instead of Secrets Manager.
- **7-day CloudWatch log retention**, no Container Insights.
- **AWS Budgets** alerts at $20 / $50 / $100; tag everything `env=dev`; scheduled job stops RDS and scales Fargate to 0 nights/weekends.

After month 12 the free RDS/EC2/ALB hours end; a shared dev environment then costs roughly $30–70/month. Between active sprints, tear it down and rely on local + ephemeral CI environments.
