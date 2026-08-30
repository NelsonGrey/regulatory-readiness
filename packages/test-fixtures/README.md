# @rre/test-fixtures

Deterministic fixtures shared by unit, integration, and e2e tests: tenants,
entities, documents, and control cases covering every readiness/applicability
state. Seeded clocks and IDs only — no randomness (engine Handoff §11.3).

Current: `FIXED_NOW`, `EVERY_READINESS_STATE`, two seeded tenants. Grows with the
slices.
