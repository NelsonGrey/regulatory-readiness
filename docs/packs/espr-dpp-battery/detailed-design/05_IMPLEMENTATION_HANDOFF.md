# 05 — Implementation Handoff

## 1. Handoff objective

Build a production-minded responsive web MVP that helps an LMT-battery economic operator collect, review, version, and export supplier evidence against a dated EU battery-passport control snapshot.

The implementation is successful only when the system preserves provenance and uncertainty. It is not a passport generator, certification service, legal-advice engine, or direct DPP Registry submission client.

## 2. Required reading and precedence

Implementers MUST read, in order:

1. [../BUSINESS_REQUIREMENTS.md](../BUSINESS_REQUIREMENTS.md)
2. [../TECHNICAL_REQUIREMENTS.md](../TECHNICAL_REQUIREMENTS.md)
3. [README.md](README.md)
4. [01_EXPERIENCE_FOUNDATIONS.md](01_EXPERIENCE_FOUNDATIONS.md)
5. [02_OPERATOR_WEB_APP.md](02_OPERATOR_WEB_APP.md)
6. [03_SUPPLIER_AND_REVIEW_PORTALS.md](03_SUPPLIER_AND_REVIEW_PORTALS.md)
7. [04_TRACEABILITY_AND_ACCEPTANCE.md](04_TRACEABILITY_AND_ACCEPTANCE.md)

Regulation and official source changes override product documents after an explicit impact review. Do not silently rewrite the checked-in control catalog.

## 3. Recommended repository shape

```text
passport-inbox/
  apps/
    web/                    # operator, supplier, and reviewer React routes
    api/                    # modular Node/TypeScript HTTP application
    worker/                 # queue consumers and scheduled jobs
  packages/
    domain/                 # entities, state machines, policies; framework-light
    control-catalog/        # immutable source snapshots and compiler/validator
    contracts/              # API schemas, events, export profiles
    authorization/          # capabilities, scopes, policy tests
    ui/                     # accessible shared components and tokens
    test-fixtures/          # deterministic tenants/models/docs/control cases
    observability/          # structured logging, metrics, trace helpers
  migrations/               # forward database migrations
  docs/
    adr/                    # material decisions and threat assumptions
    runbooks/               # incident, revocation, restore, deletion, key rotation
  tests/
    e2e/                    # browser journeys by screen/use-case ID
    security/               # tenant, IDOR, token, file and disclosure tests
    accessibility/          # automation plus manual-evidence index
  infra/                    # environment configuration without secrets
```

Use a modular monolith first. Module boundaries MUST be explicit enough to separate later, but network-distributed services are not an MVP goal.

## 4. Modules and ownership boundaries

| Module | Owns | Must not own |
| --- | --- | --- |
| Identity/Tenancy | users, memberships, sessions, invitations, support grants | Evidence decisions |
| Catalog/Applicability | immutable controls, source metadata, compiled rules, evaluations | Customer-approved claims |
| Models | products, battery models, scope versions, assignments | Supplier authentication |
| Requests | suppliers, recipients, request versions, tokens, drafts, submissions, reminders | Approval mutation |
| Evidence | document metadata/versions, storage, scan, citations, classifications | Readiness verdict policy |
| Extraction | jobs, derived text, proposals, confidence/provenance | Approved claims |
| Claims/Review | assertions, proposals, decisions, conflicts, approved claims | Source-catalog editing |
| Readiness | deterministic per-control/model state and immutable snapshots | Legal compliance conclusion |
| Export/Share | profiles, artifacts, manifests, reviewer shares/access logs | Canonical domain schema |
| Audit/Lifecycle | events, retention, holds, deletion jobs, customer exports | Business-object backdoors |
| Notifications | templates, delivery, reminders, quiet periods | Confidential evidence content |

Cross-module writes go through application services and one documented transaction/outbox boundary. Direct table mutation from unrelated modules is prohibited.

## 5. Source-control catalog seed

The initial checked-in snapshot should use a stable folder such as:

```text
packages/control-catalog/snapshots/EC-BP-2026-08-15/
  manifest.json
  controls.json
  source-notes.md
  test-vectors.json
```

`manifest.json` MUST contain catalog key, source title, official URL, publication/guidance date, retrieval date, source checksum, compiler version, status, and supersedes/superseded-by metadata.

`controls.json` MUST contain exactly the 71 category-dependent data-point records transcribed from the dated Commission guidance baseline. Each record needs stable internal key, displayed number/name, category applicability, timing, value type/unit constraints, evidence expectations, access-class default, source locator, and any compiled applicability expression.

An independent two-person source review is a `GATE` before production use. Automated tests validate count, unique keys, referential integrity, rule compilation, known category outcomes, and checksum. A corrected catalog is a new immutable snapshot even if the source date is unchanged.

## 6. Feature flags and release states

| Flag | Default | State | Rule |
| --- | --- | --- | --- |
| `catalog_ec_bp_2026_08_15` | On in non-production | `PILOT/GATE` | Production only after independent transcription review |
| `supplier_portal` | On | `PILOT` | Required before paid pilot |
| `document_extraction` | Off | `PILOT/GATE` | Enable only after provider/privacy/accuracy gates |
| `conflict_resolution` | On | `MVP` | Required before evidence-ready snapshots |
| `external_reviewer_shares` | Off | `MVP` | Enable after disclosure/IDOR security tests |
| `accessible_pdf_export` | Off | `LATER/GATE` | No PDF claim until tagged-output verification |
| `email_ingest` | Off | `PILOT/GATE` | Enable only after sender/authentication/attachment threat review |
| `publisher_connectors` | Off | `LATER/GATE` | Add one versioned mapping profile at a time |
| `dpp_registry_submission` | Off | Out of scope | Do not expose without new authoritative requirements |
| `consultancy_mode` | Off | `LATER` | Requires AC-024 and commercial decision |

Disabled flags MUST fail closed at route, service, worker, and UI layers. Do not seed production navigation with a convincing but non-functional workflow.

## 7. Vertical implementation sequence

### Slice 0 — Evidence and architecture gates

**Deliver:**

- confirm official baseline URLs and archive provenance metadata;
- create ADRs for tenancy, authorization, audit immutability, storage/encryption, token model, extraction provider, and retention;
- complete threat model for operator, supplier, reviewer, file, queue, and support boundaries;
- create deterministic fixtures spanning all readiness/applicability states;
- record go/no-go owners for FSG-001 through FSG-006 in the TRD.

**Exit:** No unresolved architecture choice permits cross-tenant access, silent extraction approval, mutable history, or uncontrolled external disclosure.

### Slice 1 — Foundation, tenancy, and catalog

**Deliver:** operator shell, sign-in/invitation, workspace/membership roles, catalog loader/validator, model creation, scope version, applicability evaluation, audit/event outbox, and `PUB-001/PUB-002` content.

**Screens:** `PUB-001`, `PUB-002`, `AUTH-001`, `AUTH-002`, `DASH-001` empty state, `MOD-001`, basic `MOD-002`, `SET-001`, `SET-002`.  
**Exit:** AC-002, AC-003, and source-count/provenance tests pass.

### Slice 2 — Matrix and accountability

**Deliver:** deterministic readiness states, matrix/detail, owner/supplier assignment, model dashboard counts, history, scope-change diff.

**Screens:** `DASH-001`, `MOD-002`, `MAT-001`, `MAT-002`, `SUPP-001`.  
**Exit:** AC-004 and AC-005 pass on every state fixture and required form factor.

### Slice 3 — Supplier request loop

**Deliver:** request builder/version, secure token principal, delivery, drafts, typed responses, upload initiation, immutable submission/receipt, revoke/extend/resend, reminder scheduler.

**Screens:** `REQ-001`–`REQ-003`, `SUP-001`–`SUP-006`.  
**Exit:** AC-006, AC-007, AC-017, relevant AC-019 cases, and 320 px supplier flow pass.

### Slice 4 — Evidence intake and safety

**Deliver:** direct object upload, scan/quarantine, document/version metadata, classification, evidence citation, preview authorization, lifecycle state.

**Screens:** `DOC-001`, `DOC-002`, `SUP-004`.  
**Exit:** AC-008 and document portions of AC-015 pass; no unscanned file is previewable, extractable, or downloadable.

### Slice 5 — Proposal, review, and conflict

**Deliver:** manual proposal, optional extraction adapter/job, exact citations, review state machine, claim revisions, conflict detection/resolution, staleness.

**Screens:** `REV-001`, `REV-002`, mature `MAT-002`/`DOC-002`.  
**Exit:** AC-009–AC-011 pass; mutation and audit invariants pass under concurrency.

### Slice 6 — Snapshot and portable export

**Deliver:** snapshot preflight, immutable readiness manifest, snapshot history, JSON/CSV profile, evidence bundle, classification preview, reproducibility/hashes.

**Screens:** `SNP-001`, `SNP-002`, export portion of `EXP-001`.  
**Exit:** AC-013, AC-014, AC-016, and forbidden-claim checks pass.

### Slice 7 — Restricted reviewer and administration

**Deliver:** share disclosure preview, secure reviewer principal, per-file/range authorization, expiry/revocation/download logging, audit viewer, security/support grants, retention/export/deletion administration.

**Screens:** reviewer portion of `EXP-001`, `EXT-001`–`EXT-003`, `AUD-001`, `SET-003`, `SET-004`, `SET-006`.  
**Exit:** AC-015, AC-018–AC-021 pass plus external security test.

### Slice 8 — Release hardening

**Deliver:** device/browser/accessibility matrix, recovery/restore exercise, performance/load evidence, incident/revocation tabletop, content review, operational dashboards/alerts, runbooks, data-processing inventory.

**Exit:** AC-022, AC-023, all BR-001–BR-027 coverage, and the release evidence package pass with no critical/high unresolved finding.

## 8. API and contract workflow

- Define request/response/event/export schemas in `packages/contracts` before route implementation.
- Validate at every trust boundary; never trust client role, tenant, state, classification, or object ownership.
- Use opaque identifiers externally and tenant predicates on every data access path.
- Require idempotency keys for request send, supplier submission, review decision, snapshot, export, share creation/revocation, and deletion requests.
- Use optimistic concurrency/version fields for editable drafts and decisions.
- Publish background work through a transactional outbox; workers reauthorize tenant/object state and are idempotent.
- Return stable machine error codes plus safe localized messages; do not leak supplier existence or document metadata.
- Generate API documentation and consumer contract tests from the schemas.

## 9. Database and migration rules

- All tenant-owned rows carry a non-null `tenant_id`; composite uniqueness includes tenant where appropriate.
- Immutable objects use append-only versions and supersession links, not in-place edits.
- Material business state changes and outbox/audit records commit atomically.
- Use database constraints for state enums, uniqueness, parent/version relationships, and impossible deletions where practical.
- Store instants in UTC and retain relevant workspace/source time-zone/date context separately.
- File bytes remain in object storage; database stores stable object/version identifiers, hashes, size, media type, scan state, and envelope-key reference.
- Every migration has forward validation, deployment ordering, backfill plan, and recovery strategy; destructive column removal follows a multi-release expand/migrate/contract sequence.

## 10. Security and privacy implementation checklist

- [ ] OIDC/session design, MFA enforcement, rotation, revocation, and re-authentication tested.
- [ ] Tenant isolation enforced in repositories, services, jobs, search, cache keys, storage paths, and observability.
- [ ] Supplier/reviewer tokens hashed, purpose-bound, expiring, revocable, rate-limited, and absent from telemetry/referrers.
- [ ] Authorization occurs server-side on every object, citation range, file, export, and download.
- [ ] Upload uses direct short-lived credentials, byte/size/type checks, safe names, malware scan, quarantine, and no active-content rendering.
- [ ] HTML/PDF/document previews use sandboxed, transformed content and deny outbound content fetch where possible.
- [ ] Encryption in transit and at rest includes object storage; secret/key rotation is documented.
- [ ] Logs and analytics exclude claim values, document text, tokens, credentials, and unnecessary supplier personal data.
- [ ] CSP, CSRF, CORS, clickjacking, XSS, injection, SSRF, path traversal, archive-bomb, and formula-injection controls tested.
- [ ] Exports neutralize spreadsheet formulas and include classification/recipient confirmation.
- [ ] Support access is customer-granted, visible, narrow, time-bound, read-only by default, and audited.
- [ ] Backup/restore, retention, legal hold, deletion, and incident/revocation runbooks exercised.

## 11. Test architecture

### 11.1 Unit and property tests

- applicability expression compiler and 71-control catalog integrity;
- readiness precedence and invariants across generated state combinations;
- unit/value normalization while preserving originals;
- claim, request, submission, document, conflict, and share state machines;
- permission policy matrices and expiration boundaries;
- export classification filter and deterministic ordering/hashing.

### 11.2 Integration tests

- transaction/outbox atomicity and duplicate delivery;
- database tenant predicates and cross-tenant identifier swapping;
- storage credential scope, scan/quarantine, preview and citation access;
- identity/invitation/MFA/session revocation;
- email delivery, bounce, reminder caps and quiet periods;
- extraction timeout/failure/retry with no claim mutation;
- retention, legal hold, deletion, backup and restore.

### 11.3 End-to-end tests

Name tests with use case and screen IDs, for example `UC-007_SUP-001_to_SUP-006_supplier_submission.spec.ts`. Cover every scenario in document 04. Use stable seeded clocks/IDs/files and assert audit events, not only visible text.

### 11.4 Accessibility and visual evidence

- Automated checks run on each stable route/state but are not sufficient alone.
- Keyboard and screen-reader scripts cover sign-in, model creation, matrix/detail, request builder, supplier submission, review/conflict, snapshot/export, reviewer disclosure, and destructive administration.
- Visual regression fixtures include loading, empty, error, long text, localization expansion, every readiness state, phone/tablet/desktop, and 200% zoom.

### 11.5 Security tests

Run dependency/secret/static checks plus dynamic tests for tenant IDOR, token leakage/replay, request forgery, injection, stored XSS in supplier fields/filenames, malicious documents, unauthorized range requests, redaction bypass, export formula injection, concurrency, rate limits, and support-grant escalation.

## 12. Observability and operations

**Metrics:** API latency/error by safe route family; request delivery/bounce; link validation/revocation; upload/scan/extraction queue age; proposal/review aging; conflict/stale counts; snapshot/export job duration/failure; authorization denials; retention/deletion job status; support-grant use.

**Logs/traces:** Use correlation, tenant pseudonym, actor type, operation, object type/opaque ID, result, safe error code, and latency. Never include raw tokens, document content, claim values, confidential filenames, or unbounded request bodies.

**Alerts:** prolonged scan/extraction queues, revocation failures, repeated authorization anomalies, export/deletion failures, backup/restore failures, notification spikes, error-budget breach, source-catalog update overdue.

**Runbooks:** incident triage/communication, compromised-link bulk revoke, object quarantine, identity/session revoke, customer support grant, export failure, deletion exception, catalog source update, key rotation, backup restore, and provider outage/manual fallback.

## 13. Content and design-system controls

- Centralize readiness labels, explanations, limitation copy, email templates, and forbidden claims.
- Components render enum states exhaustively; an unknown state is an error, not a green/default chip.
- Store official source title/URL/date with the catalog, not in scattered UI constants.
- Use stable screen IDs in route metadata, analytics event names, tests, design files, and support documentation.
- Treat all supplier names, notes, values, excerpts, and filenames as untrusted display content.
- Never add gamified completion, a compliance score, or celebratory certification treatment.

## 14. Stop conditions

Stop and escalate rather than infer when:

1. the official baseline cannot be faithfully transcribed or independently reviewed;
2. an applicability rule is legally ambiguous and materially changes required controls;
3. a proposed integration would make aggregated/predicted availability look authoritative;
4. a passport publisher or Registry requires credentials/contracts/specifications not actually available;
5. the extraction provider's privacy, residency, training, retention, or deletion terms are unacceptable or unknown;
6. a tenant-isolation, token-leakage, unscanned-file, immutable-history, backup/restore, or revocation test fails;
7. a requested marketing/UI change would imply certification, legal completeness, authority approval, or Registry submission;
8. an accessible fallback cannot be provided for a required workflow;
9. a destructive data action has an unresolved target, hold, retention, or recovery question.

## 15. MVP definition of done

The MVP is done only when:

- BR-001 through BR-027 and their document-04 acceptance scenarios pass or have a named, explicitly accepted release exception;
- the initial control catalog is independently verified, checksum-addressed, immutable, and proves 71 unique control records;
- all required operator, supplier, and reviewer routes implement documented roles, states, responsive behavior, and audit events;
- every approved claim is traceable to an eligible immutable evidence citation and human decision;
- conflict, staleness, pending review, conditional uncertainty, and source updates block or warn exactly as specified;
- historic snapshots and exports reproduce after current model/catalog changes;
- external disclosures match their previews and resist tenant/IDOR/token/range-access attacks;
- accessibility, security, performance, recovery, retention/deletion, and incident/revocation evidence is retained;
- production telemetry and support tools reveal no sensitive evidence or raw access token;
- customer-facing copy passes source-date, limitation, and forbidden-claim review;
- remaining `LATER`, `GATE`, and out-of-scope work is visibly separated from live capability.

## 16. First production backlog

Create epics matching slices 0–8. Each story MUST include:

- governing BR/TR/use-case/screen/acceptance IDs;
- persona and tenant scope;
- normal, empty, loading, error, permission, expiration, concurrency, and audit behavior as applicable;
- phone/tablet/desktop and accessibility acceptance;
- security/privacy classification and logging exclusions;
- migration/rollback or feature-flag plan;
- automated and manual evidence required to close the story.

Do not split stories into “frontend complete” and “backend complete” milestones that can be marked done without an end-to-end, server-authorized, audited outcome.
