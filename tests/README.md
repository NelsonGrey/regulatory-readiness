# tests

Cross-cutting test suites that span packages and apps. Unit tests live next to
their source (`*.test.ts`); this folder is for the wider suites.

| Folder | Scope | Reference |
| --- | --- | --- |
| `e2e/` | Browser journeys named by use-case + screen ID (e.g. `UC-007_SUP-001_to_SUP-006_*.spec.ts`) | [Implementation Handoff §11.3](../docs/engine/detailed-design/05_IMPLEMENTATION_HANDOFF.md) |
| `security/` | Tenant + pack isolation, IDOR, token leakage/replay, malicious files, redaction bypass, export formula injection, support-grant escalation | [Handoff §11.5](../docs/engine/detailed-design/05_IMPLEMENTATION_HANDOFF.md) |
| `accessibility/` | Automated checks per route/state + a manual keyboard/screen-reader evidence index | [Handoff §11.4](../docs/engine/detailed-design/05_IMPLEMENTATION_HANDOFF.md) |

Empty until the corresponding slices.
