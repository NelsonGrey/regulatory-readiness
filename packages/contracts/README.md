# @rre/contracts

Shared schemas for API requests/responses, domain events, export profiles, and
control-pack artifacts. **Zod is the single source of truth**; TypeScript types
are inferred, and OpenAPI/JSON Schema is generated from here (engine Handoff §8).

Current: `PackManifest`, `ApplicabilityResult`, `ReadinessState`.
