# 05 — Implementation Handoff

## 1. Handoff objective

Build a production-minded responsive web MVP that helps an organization collect, review, version, and export evidence against a dated regulatory control snapshot — for one validated control pack, on an engine that can host more packs without domain changes.

The implementation is successful only when the system preserves provenance and uncertainty. It is not a record generator, certification service, legal-advice engine, or direct authority-submission client.

## 2. Required reading and precedence

1. [../BUSINESS_REQUIREMENTS.md](../BUSINESS_REQUIREMENTS.md)
2. [../TECHNICAL_REQUIREMENTS.md](../TECHNICAL_REQUIREMENTS.md)
3. [../../ARCHITECTURE_AWS.md](../../ARCHITECTURE_AWS.md)
4. [README.md](README.md)
5. [01_EXPERIENCE_FOUNDATIONS.md](01_EXPERIENCE_FOUNDATIONS.md)
6. [02_OPERATOR_WEB_APP.md](02_OPERATOR_WEB_APP.md)
7. [03_CONTRIBUTOR_AND_REVIEW_PORTALS.md](03_CONTRIBUTOR_AND_REVIEW_PORTALS.md)
8. [04_TRACEABILITY_AND_ACCEPTANCE.md](04_TRACEABILITY_AND_ACCEPTANCE.md)

Regulation and official source changes override product documents after an explicit impact review. Do not silently rewrite a checked-in control pack.

## 3. Recommended repository shape

```text
regulatory-readiness/
  apps/
    web/                    # operator, contributor, and reviewer React routes
    api/                    # modular Node/TypeScript HTTP application
    worker/                 # queue consumers and scheduled jobs
  packages/
    domain/                 # entities, state machines, policies; framework-light
    control-catalog/        # pack loader, compiler, validator; pack-agnostic
    contracts/              # API schemas, events, export profiles
    authorization/          # capabilities, scopes, policy tests
    ui/                     # accessible shared components and tokens
    test-fixtures/          # deterministic tenants/entities/docs/control cases
    observability/          # structured logging, metrics, trace helpers
  packs/
    espr-dpp-battery/       # origin pack data (see docs/packs/espr-dpp-battery/)
    eaa-accessibility/      # pack #1 data
  infra/                    # AWS CDK, no secrets
  migrations/               # forward database migrations
  docs/                     # this documentation set
  tests/
    e2e/                    # browser journeys by screen/use-case ID
    security/               # tenant, pack, IDOR, token, file and disclosure tests
    accessibility/          # automation plus manual-evidence index
```

Use a modular monolith first. Module boundaries MUST be explicit enough to separate later; network-distributed services are not an MVP goal.

## 4. Modules and ownership boundaries

| Module | Owns | Must not own |
| --- | --- | --- |
| Identity/Tenancy | users, memberships, sessions, invitations, support grants | Evidence decisions |
| Pack registry | installed packs, catalog load/validate, versioning, activation | Customer-approved claims |
| Catalog/Applicability | immutable controls, source metadata, compiled rules, evaluations | Customer-approved claims |
| Entities | regulated entities, scope versions, assignments | Contributor authentication |
| Requests | external parties, recipients, request versions, tokens, drafts, submissions, reminders | Approval mutation |
| Evidence | document metadata/versions, storage, scan, citations, classifications | Readiness verdict policy |
| Extraction | jobs, derived text, proposals, confidence/provenance | Approved claims |
| Claims/Review | assertions, proposals, decisions, conflicts, approved claims | Source-catalog editing |
| Readiness | deterministic per-control/entity state and immutable snapshots | Legal compliance conclusion |
| Export/Share | profiles, artifacts, manifests, reviewer shares/access logs | Canonical domain schema |
| Audit/Lifecycle | events, retention, holds, deletion jobs, customer exports | Business-object backdoors |
| Notifications | templates, delivery, reminders, quiet periods | Confidential evidence content |

Cross-module writes go through application services and one documented transaction/outbox boundary. Direct table mutation from unrelated modules is prohibited.

## 5. Control-pack registry and seed

Each pack is a checked-in immutable data bundle:

```text
packs/<pack-key>/
  manifest.json
  controls.json
  entity-facts.schema.json
  applicability/
  export-profiles/
  validators/
  copy/
  test-vectors.json
  source-notes.md
```

`manifest.json` MUST contain pack key, source title, official URL, publication/guidance date, retrieval date, source checksum, compiler version, jurisdiction, effective dates, status, and supersedes/superseded-by metadata. `controls.json` MUST contain exactly the pack's declared control records transcribed from the dated source baseline.

The `control-catalog` package loads and validates any pack: control count, unique keys, referential integrity, rule compilation, known category outcomes, checksum. An independent two-person source review is a `GATE` before production use of any pack. A corrected pack is a new immutable snapshot even if the source date is unchanged.

## 6. Feature flags and release states

| Flag | Default | State | Rule |
| --- | --- | --- | --- |
| `pack_eaa_accessibility` | On in non-production | `PILOT/GATE` | Production only after independent transcription review |
| `pack_espr_dpp_battery` | Off | `LATER/GATE` | Origin design; not the MVP pack |
| `contributor_portal` | On | `PILOT` | Required before paid pilot |
| `document_extraction` | Off | `PILOT/GATE` | Enable only after provider/privacy/accuracy gates |
| `conflict_resolution` | On | `MVP` | Required before evidence-ready snapshots |
| `external_reviewer_shares` | Off | `MVP` | Enable after disclosure/IDOR security tests |
| `accessible_pdf_export` | Off | `LATER/GATE` | No PDF claim until tagged-output verification |
| `email_ingest` | Off | `PILOT/GATE` | Enable only after sender/authentication/attachment threat review |
| `downstream_connectors` | Off | `LATER/GATE` | Add one versioned mapping profile at a time |
| `authority_submission` | Off | Out of scope | Do not expose without new authoritative requirements |
| `consultancy_mode` | Off | `LATER` | Requires AC-024 and commercial decision |

Disabled flags MUST fail closed at route, service, worker, and UI layers. Do not seed production navigation with a convincing but non-functional workflow.

## 7. Vertical implementation sequence

The active pack for slices 1–8 is `eaa-accessibility`.

### Slice 0 — Evidence and architecture gates

Confirm official baseline URLs and archive provenance for the active pack; create ADRs for tenancy, authorization, audit immutability, storage/encryption, token model, extraction provider, retention, and pack packaging; complete a threat model for operator, contributor, reviewer, file, queue, and support boundaries; create deterministic fixtures spanning all readiness/applicability states; record go/no-go owners for FSG-001 through FSG-006.

**Exit:** no unresolved architecture choice permits cross-tenant or cross-pack access, silent extraction approval, mutable history, or uncontrolled external disclosure.

### Slice 1 — Foundation, tenancy, and pack registry

Operator shell, sign-in/invitation, workspace/membership roles, pack loader/validator, entity creation, scope version, applicability evaluation, audit/event outbox, `PUB-001/PUB-002` content.

**Screens:** `PUB-001`, `PUB-002`, `AUTH-001`, `AUTH-002`, `DASH-001` empty state, `ENT-001`, basic `ENT-002`, `SET-001`, `SET-002`.
**Exit:** AC-002, AC-003, AC-025, and pack control-count/provenance tests pass.

### Slice 2 — Matrix and accountability

Deterministic readiness states, matrix/detail, owner/party assignment, entity dashboard counts, history, scope-change diff.

**Screens:** `DASH-001`, `ENT-002`, `MAT-001`, `MAT-002`, `SUPP-001`.
**Exit:** AC-004 and AC-005 pass on every state fixture and required form factor.

### Slice 3 — Contributor request loop

Request builder/version, secure token principal, delivery, drafts, typed responses, upload initiation, immutable submission/receipt, revoke/extend/resend, reminder scheduler.

**Screens:** `REQ-001`–`REQ-003`, `SUP-001`–`SUP-006`.
**Exit:** AC-006, AC-007, AC-017, relevant AC-019 cases, and the 320 px contributor flow pass.

### Slice 4 — Evidence intake and safety

Direct object upload, scan/quarantine, document/version metadata, classification, evidence citation, preview authorization, lifecycle state.

**Screens:** `DOC-001`, `DOC-002`, `SUP-004`.
**Exit:** AC-008 and document portions of AC-015 pass; no unscanned file is previewable, extractable, or downloadable.

### Slice 5 — Proposal, review, and conflict

Manual proposal, optional extraction adapter/job, exact citations, review state machine, claim revisions, conflict detection/resolution, staleness.

**Screens:** `REV-001`, `REV-002`, mature `MAT-002`/`DOC-002`.
**Exit:** AC-009–AC-011 pass; mutation and audit invariants pass under concurrency.

### Slice 6 — Snapshot and portable export

Snapshot preflight, immutable readiness manifest, snapshot history, JSON/CSV profile, evidence bundle, classification preview, reproducibility/hashes.

**Screens:** `SNP-001`, `SNP-002`, export portion of `EXP-001`.
**Exit:** AC-013, AC-014, AC-016, and forbidden-claim checks pass.

### Slice 7 — Restricted reviewer and administration

Share disclosure preview, secure reviewer principal, per-file/range authorization, expiry/revocation/download logging, audit viewer, security/support grants, retention/export/deletion administration.

**Screens:** reviewer portion of `EXP-001`, `EXT-001`–`EXT-003`, `AUD-001`, `SET-003`, `SET-004`, `SET-006`.
**Exit:** AC-015, AC-018–AC-021 pass plus external security test.

### Slice 8 — Release hardening

Device/browser/accessibility matrix, recovery/restore exercise, performance/load evidence, incident/revocation tabletop, content review, operational dashboards/alerts, runbooks, data-processing inventory.

**Exit:** AC-022, AC-023, all BR-001–BR-029 coverage, and the release evidence package pass with no critical/high unresolved finding.

## 8. API and contract workflow

- Define request/response/event/export schemas in `packages/contracts` before route implementation.
- Validate at every trust boundary; never trust client role, tenant, pack, state, classification, or object ownership.
- Use opaque identifiers externally and tenant + pack predicates on every data access path.
- Require idempotency keys for request send, contributor submission, review decision, snapshot, export, share creation/revocation, and deletion requests.
- Use optimistic concurrency/version fields for editable drafts and decisions.
- Publish background work through a transactional outbox; workers reauthorize tenant/pack/object state and are idempotent.
- Return stable machine error codes plus safe localized messages; do not leak contributor existence or document metadata.
- Generate API documentation and consumer contract tests from the schemas.

## 9. Database and migration rules

- All tenant-owned rows carry a non-null `tenant_id`; all pack-catalog rows carry a non-null `pack_key`; composite uniqueness includes tenant/pack where appropriate.
- Immutable objects use append-only versions and supersession links, not in-place edits.
- Material business state changes and outbox/audit records commit atomically.
- Use database constraints for state enums, uniqueness, parent/version relationships, and impossible deletions where practical.
- Store instants in UTC and retain relevant workspace/source time-zone/date context separately.
- File bytes remain in object storage; the database stores stable object/version identifiers, hashes, size, media type, scan state, and envelope-key reference.
- Every migration has forward validation, deployment ordering, backfill plan, and recovery strategy; destructive column removal follows expand/migrate/contract.

## 10. Security and privacy implementation checklist

- [ ] OIDC/session design, MFA enforcement, rotation, revocation, and re-authentication tested.
- [ ] Tenant **and pack** isolation enforced in repositories, services, jobs, search, cache keys, storage paths, and observability.
- [ ] Contributor/reviewer tokens hashed, purpose-bound, expiring, revocable, rate-limited, and absent from telemetry/referrers.
- [ ] Authorization occurs server-side on every object, citation range, file, export, and download.
- [ ] Upload uses direct short-lived credentials, byte/size/type checks, safe names, malware scan, quarantine, and no active-content rendering.
- [ ] HTML/PDF/document previews use sandboxed, transformed content and deny outbound content fetch where possible.
- [ ] Encryption in transit and at rest includes object storage; secret/key rotation is documented.
- [ ] Logs and analytics exclude claim values, document text, tokens, credentials, and unnecessary contributor personal data.
- [ ] CSP, CSRF, CORS, clickjacking, XSS, injection, SSRF, path traversal, archive-bomb, and formula-injection controls tested.
- [ ] Exports neutralize spreadsheet formulas and include classification/recipient confirmation.
- [ ] Support access is customer-granted, visible, narrow, time-bound, read-only by default, and audited.
- [ ] Backup/restore, retention, legal hold, deletion, and incident/revocation runbooks exercised.

## 11. Test architecture

### 11.1 Unit and property tests

Applicability expression compiler and per-pack catalog integrity; readiness precedence and invariants across generated state combinations; unit/value normalization while preserving originals; claim, request, submission, document, conflict, and share state machines; permission policy matrices and expiration boundaries; export classification filter and deterministic ordering/hashing.

### 11.2 Integration tests

Transaction/outbox atomicity and duplicate delivery; database tenant and pack predicates with cross-tenant and cross-pack identifier swapping; storage credential scope, scan/quarantine, preview and citation access; identity/invitation/MFA/session revocation; email delivery, bounce, reminder caps and quiet periods; extraction timeout/failure/retry with no claim mutation; retention, legal hold, deletion, backup and restore.

### 11.3 End-to-end tests

Name tests with use-case and screen IDs, e.g. `UC-007_SUP-001_to_SUP-006_contributor_submission.spec.ts`. Cover every scenario in document 04. Use stable seeded clocks/IDs/files and assert audit events, not only visible text.

### 11.4 Accessibility and visual evidence

Automated checks on each stable route/state (not sufficient alone); keyboard and screen-reader scripts covering sign-in, entity creation, matrix/detail, request builder, contributor submission, review/conflict, snapshot/export, reviewer disclosure, and destructive administration; visual regression fixtures including loading, empty, error, long text, localization expansion, every readiness state, phone/tablet/desktop, and 200% zoom.

### 11.5 Security tests

Dependency/secret/static checks plus dynamic tests for tenant IDOR, cross-pack access, token leakage/replay, request forgery, injection, stored XSS in contributor fields/filenames, malicious documents, unauthorized range requests, redaction bypass, export formula injection, concurrency, rate limits, and support-grant escalation.

## 12. Observability and operations

**Metrics:** API latency/error by safe route family; request delivery/bounce; link validation/revocation; upload/scan/extraction queue age; proposal/review aging; conflict/stale counts; snapshot/export job duration/failure; authorization denials; retention/deletion job status; support-grant use; per-pack catalog-update overdue.

**Logs/traces:** correlation, tenant pseudonym, pack key, actor type, operation, object type/opaque ID, result, safe error code, latency. Never raw tokens, document content, claim values, confidential filenames, or unbounded request bodies.

**Alerts:** prolonged scan/extraction queues, revocation failures, repeated authorization anomalies, export/deletion failures, backup/restore failures, notification spikes, error-budget breach, source-catalog update overdue.

**Runbooks:** incident triage/communication, compromised-link bulk revoke, object quarantine, identity/session revoke, customer support grant, export failure, deletion exception, pack source update, key rotation, backup restore, and provider outage/manual fallback.

## 13. Content and design-system controls

- Centralize readiness labels, explanations, limitation copy, email templates, and forbidden claims.
- Components render enum states exhaustively; an unknown state is an error, not a green/default chip.
- Store official source title/URL/date with the pack, not in scattered UI constants.
- Use stable screen IDs in route metadata, analytics event names, tests, design files, and support documentation.
- Treat all contributor names, notes, values, excerpts, and filenames as untrusted display content.
- Never add gamified completion, a compliance score, or celebratory certification treatment.

## 14. Stop conditions

Stop and escalate rather than infer when: the official baseline cannot be faithfully transcribed or independently reviewed; an applicability rule is legally ambiguous and materially changes required controls; a proposed integration would make aggregated/predicted availability look authoritative; a downstream consumer or authority requires credentials/contracts/specifications not actually available; the extraction provider's privacy, residency, training, retention, or deletion terms are unacceptable or unknown; a tenant-isolation, pack-isolation, token-leakage, unscanned-file, immutable-history, backup/restore, or revocation test fails; a requested marketing/UI change would imply certification, legal completeness, authority approval, or submission; an accessible fallback cannot be provided for a required workflow; a destructive data action has an unresolved target, hold, retention, or recovery question.

## 15. MVP definition of done

- BR-001 through BR-029 and their document-04 acceptance scenarios pass or have a named, explicitly accepted release exception.
- The active control pack is independently verified, checksum-addressed, immutable, and proves its declared control count with unique keys.
- All required operator, contributor, and reviewer routes implement documented roles, states, responsive behavior, and audit events.
- Every approved claim is traceable to an eligible immutable evidence citation and human decision.
- Conflict, staleness, pending review, conditional uncertainty, and source updates block or warn exactly as specified.
- Historic snapshots and exports reproduce after current entity/pack changes.
- External disclosures match their previews and resist tenant/pack/IDOR/token/range-access attacks.
- Accessibility, security, performance, recovery, retention/deletion, and incident/revocation evidence is retained.
- Production telemetry and support tools reveal no sensitive evidence or raw access token.
- Customer-facing copy passes source-date, limitation, and forbidden-claim review.
- Remaining `LATER`, `GATE`, and out-of-scope work is visibly separated from live capability.

## 16. First production backlog

Create epics matching slices 0–8. Each story MUST include: governing BR/TR/use-case/screen/acceptance IDs; persona and tenant/pack scope; normal, empty, loading, error, permission, expiration, concurrency, and audit behavior as applicable; phone/tablet/desktop and accessibility acceptance; security/privacy classification and logging exclusions; migration/rollback or feature-flag plan; automated and manual evidence required to close the story.

Do not split stories into "frontend complete" and "backend complete" milestones that can be marked done without an end-to-end, server-authorized, audited outcome.
