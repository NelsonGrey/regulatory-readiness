# ADR 0003 — Authorization: capability-based, server-side, deny by default

**Status:** Accepted (proposed baseline)
**Date:** August 30, 2026
**Related:** [engine/TECHNICAL_REQUIREMENTS.md](../engine/TECHNICAL_REQUIREMENTS.md) §15; [engine/detailed-design/01_EXPERIENCE_FOUNDATIONS.md](../engine/detailed-design/01_EXPERIENCE_FOUNDATIONS.md) §3; `@rre/authorization`

## Context

Five workspace roles plus two scoped token principals, each with a defined capability set, and every object and action must be authorized on the server (engine TRD §15.3). The check must be one auditable code path, not scattered `if role ===` conditions.

## Decision

- **Two-layer check.** (1) A coarse role → capability grant lives only in `@rre/authorization` (`can(role, capability)`). (2) The API adds object-level checks: tenant match, pack match, object ownership, state preconditions, and classification.
- **Deny by default.** A request with no matching grant is denied. A disabled feature flag denies at route, service, worker, and UI layers.
- **Contributor and reviewer principals are not workspace roles.** They are opaque, hashed, purpose-bound token principals (one tenant / purpose / object / capability / expiry each), resolved by a separate middleware and never granted workspace capabilities.
- **`PLATFORM_SUPPORT`** has no standing access; it acts only within an active, time-bound, customer-visible `SupportAccessGrant`, and never gains evidence-approval capability.
- **Authorization decisions on sensitive actions are audited** (allow and deny), with actor, target, capability, and reason.
- The capability matrix is covered by an exhaustive test (`packages/authorization`) and by the API authorization-matrix integration tests (`FSG-003`).

## Consequences

- Adding a capability is a one-line matrix change plus tests; adding a role is a matrix column plus a review of every object-level check.
- The UI mirrors the matrix for enable/disable/hide decisions but is never the enforcement point.
- Object-level checks are easy to forget; a repository/service convention (every accessor takes an `AuthContext`) and a lint/review checklist mitigate this.
