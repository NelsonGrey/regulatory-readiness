# @rre/web

Operator, contributor, and reviewer React app (Vite + React 19 + React Router).
Served from S3 + CloudFront in production (engine ARCHITECTURE_AWS §4).

```bash
pnpm --filter @rre/web dev       # http://localhost:5173, /api proxied to :3000
```

Set `API_ORIGIN` to point the dev proxy elsewhere.

## Routes (so far)

| Path | Screen | Talks to |
| --- | --- | --- |
| `/` | Control-pack list | `GET /api/v1/packs` |
| `/w/entities/new` | **ENT-001** — create a regulated entity; the scope-fact form is generated from the pack's fact schema | `GET /api/v1/packs/:packKey`, `POST /api/v1/entities` |
| `/w/entities/:id/matrix` | **MAT-001** — entity-status banner, per-control applicability **and readiness**, approved value, readiness-count filter, inline "add a claim" form | `GET /entities/:id/matrix`, `POST /entities/:id/controls/:controlKey/claims` |
| `/w/entities/:id/review` | **REV-001** — pending claims; approve / reject (reason required) | `GET /entities/:id/review-queue`, `POST /claims/:claimId/decisions` |

The workspace (tenant) is a dev stand-in in the header, persisted per browser and
sent as `x-tenant-id`. The matrix never shows a "% compliant" — it shows how many
controls are required by the snapshot and why the rest are excluded.

Shared UI (`@rre/ui`): `ReadinessChip`, `ApplicabilityChip` — text + colour, throw
on an unknown value.
