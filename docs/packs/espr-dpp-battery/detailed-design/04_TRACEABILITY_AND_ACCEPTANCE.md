# 04 — Traceability and Acceptance

## 1. Purpose and test interpretation

This document proves that each business requirement is represented by an actor journey, screen, technical behavior, and testable outcome. It is the acceptance source of truth for the first implementation.

- “Pass” requires UI behavior, server authorization, persisted data, audit evidence, and the applicable responsive/accessibility checks.
- A mocked external dependency may pass a feature test but cannot close a `GATE` that calls for real integration evidence.
- A workflow does not pass if the happy path works but a listed exception can overwrite evidence, cross a tenant boundary, leak a token, or imply legal approval.

## 2. Use-case catalog

| ID | Use case | Primary actor | Entry | Successful outcome |
| --- | --- | --- | --- | --- |
| UC-001 | Create and configure workspace | `EO_ADMIN` | `AUTH-002`, `SET-001` | Tenant, identity, locale, security defaults established |
| UC-002 | Invite and govern operators | `EO_ADMIN` | `SET-002`, `SET-003` | Least-privilege membership with MFA/security policy |
| UC-003 | Create battery model and evaluate scope | Manager | `MOD-001` | Versioned model scope and applicability result |
| UC-004 | Inspect readiness and source rationale | Manager/Approver | `MOD-002`, `MAT-001`, `MAT-002` | User understands blockers and dated source |
| UC-005 | Assign internal/supplier ownership | Manager | `MAT-001`, `SUPP-001` | Accountable owner and due context recorded |
| UC-006 | Build and send supplier request | Manager | `REQ-002` | Immutable scoped request delivered and audited |
| UC-007 | Save and submit supplier response | Supplier | `SUP-001`–`SUP-006` | Immutable response and receipt created |
| UC-008 | Upload and classify evidence | Supplier/Operator | `SUP-004`, `DOC-001` | Original file safely stored, scanned, versioned, classified |
| UC-009 | Extract evidence proposals | System/Manager | `DOC-002` | Location-cited proposals await human review |
| UC-010 | Review a proposed claim | Approver | `REV-001`, `MAT-002` | Reasoned approval/rejection/clarification is audited |
| UC-011 | Resolve competing claims | Approver | `REV-002` | Conflict resolved or remains explicitly blocking |
| UC-012 | Replace or justify stale evidence | Manager/Approver | `MAT-002`, `REV-001` | Fresh or explicitly re-approved evidence supports current state |
| UC-013 | Create point-in-time readiness snapshot | Approver | `SNP-002` | Immutable reproducible verdict and manifest |
| UC-014 | Export to a portable/vendor profile | Manager | `EXP-001` | Versioned output distinguishes evidence statuses |
| UC-015 | Share restricted snapshot with reviewer | Manager | `EXP-001`, `EXT-001`–`EXT-003` | Reviewer sees only previewed immutable disclosure |
| UC-016 | Adopt a newer control snapshot | Admin/Manager | `MOD-002`, `SNP-001` | Impact reviewed; current work migrates without altering history |
| UC-017 | Monitor requests and send safe reminders | Manager | `REQ-001`, `REQ-003` | Delivery/reminder history obeys rate and quiet-period policy |
| UC-018 | Audit and investigate change | Admin/Manager | `AUD-001` | Authorized user reconstructs who changed what and why |
| UC-019 | Revoke compromised access | Admin/Manager | `REQ-003`, `EXP-001`, `SET-003` | Future supplier/reviewer access is blocked and audited |
| UC-020 | Export, retain, hold, or delete tenant data | Admin | `SET-004` | Policy-driven lifecycle action completes transparently |
| UC-021 | Grant and revoke platform support | Admin | `SET-003` | Time-bound visible grant governs support access |
| UC-022 | Operate separated client workspaces | Consultancy admin | Tenant switcher | No cross-client authorization or search results |

## 3. Persona-to-use-case coverage

| Persona | Required use cases | Explicitly excluded authority |
| --- | --- | --- |
| `EO_ADMIN` | UC-001–UC-006, UC-008, UC-010–UC-022 as permitted | Cannot alter immutable submissions/snapshots or bypass evidence gates |
| `COMPLIANCE_MANAGER` | UC-003–UC-020 except admin-only policy changes | Cannot manage tenant security or imply legal certification |
| `TECHNICAL_APPROVER` | UC-004, UC-009–UC-013, scoped UC-018 | Cannot send/share by default or administer users |
| `SUPPLIER_CONTRIBUTOR` | UC-007, UC-008 within one request | Cannot see model readiness, other assertions, suppliers, or internal review |
| `REVIEWER` | UC-015 within one disclosure | Cannot edit claims or discover current workspace state |
| `PLATFORM_SUPPORT` | Diagnostics within UC-021 grant | Cannot self-grant, silently browse, or approve evidence |

## 4. Business-requirement traceability

| Requirement | Use case(s) | Primary screens | Technical proof | Acceptance reference |
| --- | --- | --- | --- | --- |
| BR-001 | UC-003 | `MOD-001`, `MOD-002` | Versioned model/scope entities and validation | AC-003 |
| BR-002 | UC-003, UC-004 | `MOD-001`, `MAT-002` | Dated control catalog plus applicability evaluation | AC-003, AC-004 |
| BR-003 | UC-013, UC-016 | `SNP-001`, `MOD-002` | Immutable snapshot/catalog versions and migration diff | AC-013, AC-016 |
| BR-004 | UC-001, UC-002, UC-015, UC-021 | `SET-002`, portal routes | RBAC/ABAC and scoped-principal tests | AC-002, AC-015, AC-021 |
| BR-005 | UC-005 | `MAT-001`, `SUPP-001` | Assignment entity and audit event | AC-005 |
| BR-006 | UC-006 | `REQ-002`, `REQ-003` | Immutable request version and disclosure manifest | AC-006 |
| BR-007 | UC-007 | `SUP-001`–`SUP-006` | Token principal, autosave, idempotent submission | AC-007 |
| BR-008 | UC-008 | `SUP-004`, `DOC-001`, `DOC-002` | Object hash/version, malware gate, metadata/classification | AC-008 |
| BR-009 | UC-009 | `DOC-002`, `REV-001` | Extraction job creates proposals/citations only | AC-009 |
| BR-010 | UC-010 | `REV-001`, `MAT-002` | Decision state machine and reasoned audit | AC-010 |
| BR-011 | UC-010, UC-013 | `MAT-002`, `SNP-002` | Claim/evidence/reviewer/snapshot relations | AC-010, AC-013 |
| BR-012 | UC-011 | `REV-002` | Conflict detector and snapshot blocker | AC-011 |
| BR-013 | UC-004, UC-013 | `DASH-001`, `MAT-001`, `SNP-002` | Deterministic readiness engine/state enum | AC-004, AC-013 |
| BR-014 | UC-004 | `DASH-001`, `MOD-002`, `MAT-001` | Reconciled state counts, no compliance score | AC-004 |
| BR-015 | UC-017 | `REQ-001`, `REQ-003` | Scheduled delivery with caps, quiet periods, idempotency | AC-017 |
| BR-016 | UC-014 | `EXP-001` | Versioned export manifest, schema, hashes, exceptions | AC-014 |
| BR-017 | UC-014 | `EXP-001` | Status/provenance fields and export validation | AC-014 |
| BR-018 | UC-018 | `AUD-001`, object histories | Append-only event store and integrity/access checks | AC-018 |
| BR-019 | UC-015, UC-019 | `EXP-001`, `EXT-001`–`EXT-003` | Scoped share, expiry, download policy, revocation | AC-015, AC-019 |
| BR-020 | UC-008, UC-014, UC-015 | `DOC-001`, `EXP-001`, `EXT-002` | Classification authorization and disclosure filter | AC-008, AC-015 |
| BR-021 | UC-020 | `SET-004` | Retention/deletion jobs, holds, export and audit | AC-020 |
| BR-022 | All user-facing cases | All applicable routes | Automated a11y plus manual device/AT evidence | AC-022 |
| BR-023 | UC-003, UC-004, UC-013–UC-016 | Public, model, snapshot, export/share | Approved copy checks and source metadata | AC-023 |
| BR-024 | UC-014 | `EXP-001`, `SET-005` | Canonical domain separated from mapping profiles | AC-014 |
| BR-025 | UC-021 | `SET-003`, operator shell | Customer-issued grant, banner, expiry, audit | AC-021 |
| BR-026 | UC-019 | `REQ-003`, `EXP-001`, `SET-003` | Revocation propagation and incident communication path | AC-019 |
| BR-027 | UC-007 | Supplier portal, `SET-006` | Entitlement/billing test; no supplier paywall | AC-007 |
| BR-028 | UC-022 | Workspace switcher | Tenant-scoped keys, queries, storage, jobs and tests | AC-024 |

## 5. Acceptance scenarios

### AC-001 — Workspace establishment

**Given** an invited first administrator,  
**when** identity verification, invitation acceptance, and organization setup complete,  
**then** exactly one tenant-scoped membership and workspace are active with locale/security defaults, the invitation cannot be reused, and creation plus configuration events are audited without exposing credentials.

### AC-002 — Roles and tenant isolation

**Given** two unrelated tenants and users in every role,  
**when** each API, object URL, search, export, background job, WebSocket/event stream, and file request is exercised with swapped identifiers,  
**then** unauthorized access is denied without object disclosure, authorized actions match the capability matrix, and sensitive successes/failures are audited.

### AC-003 — Model scope and applicability

**Given** a manager creates a supported LMT battery model,  
**when** required scope fields are supplied and the model is saved,  
**then** the system records the exact scope values, catalog key/date, evaluation version, per-control result/rationale, actor, and time; unsupported categories cannot silently use the LMT rule set.

### AC-004 — Truthful readiness

**Given** fixtures containing every readiness state,  
**when** portfolio, model, matrix, and data-point detail are viewed,  
**then** counts reconcile, each row explains its state, unresolved items remain visible, neutral states are not counted as evidenced, and no compliance percentage or certification claim appears.

### AC-005 — Accountability

**Given** an applicable data point,  
**when** a manager assigns an internal owner, supplier, evidence source, or due date,  
**then** the assignment is visible on matrix/supplier views, history records before/after, and removal does not delete earlier requests/submissions.

### AC-006 — Least-disclosure request

**Given** controls assigned to Supplier A and internal notes/restricted evidence,  
**when** a manager previews and sends a request,  
**then** the immutable manifest contains only selected authorized fields and instructions, the supplier view matches preview, Supplier A sees no unrelated content, and delivery is audited.

### AC-007 — Supplier completion without account

**Given** a valid expiring request link,  
**when** a supplier saves drafts, uploads evidence, supplies explicit unavailable answers, reviews, and submits twice due to a retry,  
**then** one immutable submission and receipt exist, drafts survived safe interruptions, supplier payment/account creation was never requested, and the operator sees proposals—not approved claims.

### AC-008 — Safe evidence intake

**Given** clean, duplicate, oversized, unsupported, interrupted, and malicious file fixtures,  
**when** supplier and operator upload paths run,  
**then** clean originals are hashed/versioned/classified, duplicates are handled by policy, interrupted uploads recover, invalid files retain form state, and malicious files remain quarantined and unusable.

### AC-009 — Extraction is proposal-only

**Given** a document with known values, tables, ambiguous text, and low-confidence regions,  
**when** extraction completes or fails,  
**then** each output has document-version and exact-location provenance plus confidence/method, no approved claim changes, failures are retryable, and low confidence remains visibly reviewable.

### AC-010 — Human claim decision

**Given** an unreviewed supplier or extraction proposal,  
**when** an authorized approver approves, rejects, edits into a new operator claim, supersedes, or requests clarification,  
**then** evidence requirements and reasons are enforced, supplier assertions remain immutable, claim state changes correctly, and actor/time/context are auditable.

### AC-011 — Conflict handling

**Given** two comparable or non-comparable active assertions for one data point,  
**when** the readiness engine runs and an approver opens the conflict,  
**then** `CONFLICTING` blocks evidence readiness until a supported resolution with rationale; non-comparable values are not automatically ranked.

### AC-012 — Stale evidence handling

**Given** an approved claim whose evidence or as-of policy has expired,  
**when** readiness is recalculated,  
**then** the current data point becomes `STALE`, the earlier evidence and snapshots remain immutable, and only eligible replacement evidence or a policy-permitted reasoned re-approval can clear the blocker.

### AC-013 — Immutable readiness snapshot

**Given** fixtures for blocked, review-needed, evidence-ready, and outdated-source outcomes,  
**when** a user runs preflight and confirms,  
**then** the system creates the correct immutable outcome with control/scope versions, state manifest, claim/evidence references, hashes, actor, time, warnings, and limitation language; retries do not duplicate it.

### AC-014 — Portable, honest export

**Given** a fixed readiness snapshot containing approved, asserted, proposed, restricted, and unresolved records,  
**when** an authorized user previews and exports a profile,  
**then** only permitted records leave, statuses remain distinct, restrictions/exceptions/source metadata/hashes/schema version are present, and the same snapshot/profile version reproduces equivalent content.

### AC-015 — Restricted reviewer disclosure

**Given** a disclosure with selected items, classes, expiry, and download permission,  
**when** the reviewer navigates direct and guessed URLs before and after expiry/revocation,  
**then** only the previewed immutable content is available during the valid window, every file/range request reauthorizes, and later access fails without revealing current workspace state.

### AC-016 — Source-snapshot migration

**Given** a model and historic readiness snapshot on catalog A and supported catalog B,  
**when** a manager reviews the applicability/control diff and adopts B,  
**then** current work uses a new evaluation, affected claims receive appropriate review/readiness states, and catalog A plus its historic snapshot remain byte-identifiable and unchanged.

### AC-017 — Responsible reminders

**Given** open, submitted, revoked, and late requests across time zones,  
**when** reminder scheduling runs repeatedly,  
**then** only eligible requests receive idempotent non-sensitive messages within caps/quiet periods, delivery events record outcome, and submitted/revoked requests stop reminders.

### AC-018 — Audit reconstruction

**Given** a full model-to-export journey,  
**when** an authorized admin filters and exports audit history,  
**then** material evidence/security actions are reconstructable with actor, target, result, time, reason/correlation while tokens, secrets, and unnecessary document content remain absent.

### AC-019 — Compromised-link response

**Given** active supplier and reviewer links,  
**when** an authorized manager revokes them,  
**then** new access and downloads fail promptly, current sensitive sessions are invalidated by policy, revocation is audited, communication guidance is available, and the UI does not claim earlier downloads were erased.

### AC-020 — Data lifecycle

**Given** ordinary, held, expired, and deletion-request fixtures,  
**when** retention/export/deletion jobs run,  
**then** policy and legal-hold rules are enforced, impact is previewed, job state is observable, deletion is narrow and auditable, and the customer receives a completion or exception report.

### AC-021 — Customer-controlled support access

**Given** no support grant, an active scoped grant, and an expired grant,  
**when** support personnel attempt access,  
**then** access fails, succeeds only within scope with a customer-visible banner, and fails again respectively; grant creation/use/revocation/expiry are audited and support cannot approve evidence.

### AC-022 — Accessibility and responsive behavior

**Given** required browsers/devices, keyboard-only use, 200% zoom, 320 CSS-pixel reflow, and representative screen readers,  
**when** all primary operator and supplier journeys run,  
**then** content order, labels, errors, focus, tables/cards, status announcements, uploads, dialogs, and actions remain understandable and operable without hover or color-only meaning.

### AC-023 — Claims and source integrity

**Given** public, model, snapshot, export, email, supplier, and reviewer surfaces,  
**when** automated forbidden-phrase scans and human content review run,  
**then** dated sources and limitations appear where required, guidance is not presented as law, and no unsupported “compliant,” “certified,” “approved,” “complete,” or “registered” claim survives.

### AC-024 — Consultancy separation

**State:** `LATER`

**Given** a consultancy identity assigned to two client tenants,  
**when** switching, searching, exporting, processing jobs, and requesting files,  
**then** each tenant's branding/data/keys/objects remain separated and no cross-client aggregate exists without a separately defined, authorized feature.

## 6. Exception matrix

| Exception | User-visible state | Data invariant | Recovery |
| --- | --- | --- | --- |
| Catalog source newer than model | Outdated-source banner | Historical evaluations unchanged | Review diff and explicitly migrate |
| Scope fact changes applicability | Impact confirmation | Prior scope/snapshot immutable | Create new evaluation/version |
| Two users edit same claim draft | Version conflict | No silent overwrite | Compare/reload and resubmit |
| Extraction provider unavailable | Failed/retryable job | Original document available; no claim change | Retry or manual proposal |
| File scanner unavailable | Scan pending | No preview/extraction/download | Retry scan; alert by age |
| Request email bounces | Delivery failed | Request/version remains valid per policy | Correct contact and resend/rotate |
| Supplier token expires mid-draft | Expired with saved-draft notice | Draft retained per disclosed policy | Operator extends/issues link |
| Reviewer token revoked during preview | Access revoked | Snapshot/share record remains | Contact operator; no further range fetch |
| Export job partially fails | Failed, no completed artifact | No partial artifact exposed as valid | Retry idempotently |
| Evidence expires after snapshot | Current model becomes stale | Historical snapshot unchanged | Replace/review and create new snapshot |
| User removed with assigned work | Assignment warning | History preserves actor | Reassign outstanding work |
| Last admin removal attempted | Blocked action | At least one active admin | Transfer role first |
| Tenant deletion under legal hold | Blocked/exception report | Held data retained | Remove hold through authorized policy |

## 7. Form-factor coverage

| Journey | Phone | Tablet portrait | Tablet landscape | Desktop |
| --- | --- | --- | --- | --- |
| Model create/scope | Full | Full | Full | Full |
| Matrix inspect/filter | Cards/read-only bulk | Cards/table | Table + detail | Dense table + detail |
| Individual proposal review | Full | Full | Two pane | Two/three pane |
| Bulk assignment | May recommend wider screen | Full | Full | Full |
| Supplier complete/upload | Full | Full | Full | Full |
| Snapshot preflight | Full, sectioned | Full | Full | Full |
| Export disclosure preview | Full, sectioned | Full | Full | Full |
| Reviewer inspect/download | Full | Full | Full | Full |
| Security/retention administration | Emergency revoke full; complex policy readable | Full | Full | Full |

## 8. Release evidence package

Before `MVP` release, retain:

- requirement-to-test report for BR-001 through BR-027;
- representative screenshots for phone, tablet portrait/landscape, laptop, and desktop;
- accessibility automation plus manual keyboard/screen-reader report;
- tenant/RBAC/IDOR and scoped-link security test report;
- upload/malware/extraction failure test report;
- deterministic applicability/readiness/export fixture results;
- source-catalog provenance, checksum, and 71-control count validation;
- copy/legal-boundary review with unresolved decisions clearly labeled;
- backup/restore and retention/deletion exercise;
- incident/revocation tabletop result;
- performance and recovery measurements against the TRD targets.

BR-028 remains `LATER` and is not an MVP blocker unless consultancy mode is sold or enabled.
