# @rre/web

Operator, contributor, and reviewer React app (Vite + React 19 + TypeScript).
Served from S3 + CloudFront in production (engine ARCHITECTURE_AWS §4).

```bash
pnpm --filter @rre/web dev       # http://localhost:5173
```

Current: a placeholder shell that renders the readiness vocabulary via
`@rre/ui`. Routes are built per the engine detailed design (documents 01–03),
using the stable screen IDs (`PUB-*`, `AUTH-*`, `DASH-*`, `ENT-*`, `MAT-*`,
`REQ-*`, `SUP-*`, `REV-*`, `SNP-*`, `EXP-*`, `AUD-*`, `SET-*`, `EXT-*`).
