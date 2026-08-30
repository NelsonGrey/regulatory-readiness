# Regulatory Readiness Engine — Detailed Design

**Version:** 0.1
**Design baseline:** August 30, 2026
**Scope:** Responsive operator web application, no-account contributor portal, and restricted reviewer portal
**Audience:** Product designer, implementation agent, engineer, tester, security reviewer, or design partner with no prior conversation context

## 1. Purpose

This package translates the [Business Requirements](../BUSINESS_REQUIREMENTS.md) and [Technical Requirements](../TECHNICAL_REQUIREMENTS.md) into stable screen IDs, routes, fields, interactions, permissions, states, responsive behavior, acceptance criteria, and an implementation sequence — for the vertical-neutral engine. Regulation-specific labels, control lists, and export profiles come from the active [control pack](../../packs/).

It is deliberately prescriptive. An implementation should not have to infer whether an extraction is approved, what a contributor can see, how a conflict blocks readiness, or which mobile/tablet surfaces are required.

## 2. Source precedence

1. Applicable regulation and published delegated/implementing acts (via the active pack).
2. Current official registry documentation and harmonized-standard references (via the active pack).
3. Dated authority guidance, preserving its non-authoritative disclaimer (via the active pack).
4. The [Technical Requirements](../TECHNICAL_REQUIREMENTS.md) for system, security, and data contracts.
5. This detailed-design package for target UX.
6. The [Business Requirements](../BUSINESS_REQUIREMENTS.md) for product intent and commercial boundaries.

No design screen may turn guidance or customer input into legal certification.

## 3. Feature-state vocabulary

| State | Meaning | Design rule |
| --- | --- | --- |
| `PILOT` | Needed for the paid concierge workflow | May include a visibly assisted/manual step |
| `MVP` | Required for the self-serve product | Must include complete permissions, states, tests, and audit behavior |
| `LATER` | Designed handoff but excluded from MVP | Hide behind a disabled flag or omit from production navigation |
| `GATE` | Requires evidence or an external decision | Display the unmet prerequisite; never simulate completion |

## 4. Document map

| Document | Controls |
| --- | --- |
| [01_EXPERIENCE_FOUNDATIONS.md](01_EXPERIENCE_FOUNDATIONS.md) | Personas, capability model, information architecture, responsive contract, shared components, states, accessibility, trust |
| [02_OPERATOR_WEB_APP.md](02_OPERATOR_WEB_APP.md) | Operator routes and screen specifications |
| [03_CONTRIBUTOR_AND_REVIEW_PORTALS.md](03_CONTRIBUTOR_AND_REVIEW_PORTALS.md) | No-account contributor request flow and restricted reviewer experience |
| [04_TRACEABILITY_AND_ACCEPTANCE.md](04_TRACEABILITY_AND_ACCEPTANCE.md) | Use-case coverage, requirements/screens, acceptance (`AC-*`) and exception matrices |
| [05_IMPLEMENTATION_HANDOFF.md](05_IMPLEMENTATION_HANDOFF.md) | Build order, repository shape, feature flags, tests, stop conditions, definition of done |

Read in order. Screen and use-case IDs are stable cross-references.

## 5. Product surfaces

```text
Public information / sign-in
        │
        ├── Operator application: authenticated tenant workspace
        │     ├── portfolio and regulated entities
        │     ├── control matrix and evidence
        │     ├── external parties and requests
        │     ├── review and conflict resolution
        │     ├── snapshots, exports, and audit
        │     └── organization/security settings
        │
        ├── Contributor portal: scoped token principal, no workspace account
        │     ├── request explanation
        │     ├── values, documents, questions, and saved draft
        │     └── immutable submission receipt
        │
        └── Reviewer portal: invited or token-scoped read-only snapshot
              ├── readiness and unresolved items
              ├── approved claims and permitted evidence
              └── permitted export/download
```

## 6. Non-negotiable experience truths

- "Evidenced" is not "compliant," "certified," or "authority approved."
- AI/OCR output is always a proposal until an authorized human acts.
- Original contributor assertions and documents remain distinct from edited/approved claims.
- Missing, conflicting, stale, conditional, and pending items stay visible.
- Contributors see only the request sent to them.
- Restricted evidence is not included in external shares or exports by default.
- New source snapshots do not alter historical readiness.
- One regulated entity belongs to one pack; the UI never mixes controls from different packs.
- Phone and tablet behavior is designed separately; desktop tables may not simply overflow off-screen.

## 7. Application-level definition of done

A screen is complete only when: its supported personas and routes are implemented; loading, empty, success, validation, permission, network, expired, and destructive states are handled where applicable; phone, tablet, laptop, and desktop layouts pass their documented behavior; keyboard navigation, focus, labels, errors, and status announcements pass accessibility acceptance; server authorization and audit behavior are proven; claims and legal boundaries use approved language; relevant use-case and requirement rows in document 04 pass.
