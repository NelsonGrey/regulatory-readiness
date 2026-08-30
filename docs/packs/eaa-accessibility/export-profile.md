# Export profile — `eaa-accessibility`

Two profiles, both generated only from an immutable readiness snapshot.

## 1. `canonical` (always)

The engine's canonical JSON export (engine TRD §14.1) with pack additions:

- `packKey`, snapshot key, EN 301 549 version, WCAG version coupling;
- per control: key, EN 301 549 clause, WCAG SC, applicability result, readiness
  state, approved claim, evidence index (document hash + location), access class;
- unresolved exceptions list;
- the disproportionate-burden / fundamental-alteration assessments, if any, with
  the requirements they cover.

## 2. `accessibility-statement` (services)

A human-readable accessibility statement plus an evidence index, structured on the
EAA Annex V information requirements and the model used for the Web Accessibility
Directive (Commission Implementing Decision (EU) 2018/1523), adapted for the EAA.
Produced as accessible HTML; PDF is `LATER/GATE` (tagged-output verification).

### Sections

| Section | Content | Source |
| --- | --- | --- |
| Provider & service | Legal name, service name, contact for accessibility issues, feedback mechanism | Entity facts |
| Conformance status | "Meets / partially meets / does not yet meet" the requirements, referencing EN 301 549 V3.2.1 (WCAG 2.1 AA) | Derived from the snapshot verdict — **never** the word "compliant" (see [copy.md](copy.md)) |
| How the requirements are met | Per control family: what was done, tested how, when, by whom | Approved claims + evidence |
| Known limitations | Every `MISSING` / `CONFLICTING` / `STALE` / `PENDING_REVIEW` required control, in plain language, with any remediation date the customer entered | Snapshot state distribution |
| Disproportionate burden | Where claimed: which requirements, the assessment summary, review date | `EAA-PROC-*` claims |
| Preparation | Snapshot key, date, method (self-assessment / third-party), the pack's limitation statement | Snapshot metadata |
| Feedback & enforcement | The customer's feedback channel and the Irish enforcement route | Entity facts + [source-notes.md](source-notes.md) authority mapping |

### Variants

- **`ready-only`** — refuses to generate if any required control is not
  `EVIDENCED` (for publishing when the customer believes they are ready).
- **`with-exceptions`** — always generates; lists unresolved items explicitly.
  This is the default and the honest one.

## Product variant

For `entityKind = product`, the profile instead assembles the **EU declaration of
conformity** input set (Annex II/IV references, harmonised standards applied,
technical-documentation index) — not an accessibility statement. Marked
`GATE` pending review of the Irish product-conformity route.

## Safeguards

- Default export excludes source evidence files and any `INTERNAL_CONFIDENTIAL` /
  `PARTY_CONFIDENTIAL` material unless explicitly selected.
- The statement text is assembled from centralized copy tokens ([copy.md](copy.md));
  forbidden phrases are blocked at generation and in the release copy scan (AC-023).
