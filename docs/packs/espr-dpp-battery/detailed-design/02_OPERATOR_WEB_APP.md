# 02 — Operator Web Application

## 1. Scope

This document specifies the authenticated economic-operator workspace. It covers portfolio setup, battery-model scope, evidence collection, human review, point-in-time snapshots, controlled exports, and administration.

Every screen inherits the persona, responsive, accessibility, trust, form, and universal-state contracts in [01_EXPERIENCE_FOUNDATIONS.md](01_EXPERIENCE_FOUNDATIONS.md).

## 2. Global operator shell

### 2.1 Persistent context

The shell MUST display:

- active workspace and switch action;
- active product and battery model on model routes;
- active control snapshot key and publication date;
- a warning when a newer supported snapshot exists;
- current user menu and role;
- support-access banner while a platform-support grant is active.

Changing workspace clears model-scoped filters and MUST NOT carry data into the destination tenant.

### 2.2 Search, filtering, and saved views

- Global search MAY find models, supplier organizations, requests, and document metadata; it MUST NOT search raw document text across unauthorized scopes.
- Matrix, review, document, and audit filters serialize to the URL.
- Saved views are private by default. Shared views require an explicit name and workspace permission.
- CSV export of a filtered list is a separate audited action, not a side effect of filtering.

### 2.3 Common failure behavior

- `401`: preserve safe draft locally, return to sign-in, and restore after re-authentication.
- `403`: show a permission explanation without confirming an inaccessible object's existence.
- `404`: distinguish deleted/archived from mistyped only when the user may know the object.
- `409`: show the newer server version and require compare/reload before resubmission.
- `422`: keep inputs and focus a field-level plus summary error.
- `429/5xx`: retain idempotency key and offer retry without duplicating the mutation.

## 3. Public and authentication screens

### PUB-001 — Product boundary

**Route:** `/`  
**Personas:** Public  
**State:** `PILOT`, `MVP`

**Purpose:** Explain the narrow job and prevent a visitor from mistaking the service for certification or a passport publisher.

**Required content:**

- headline: supplier evidence preparation for EU battery-passport work;
- supported initial category: LMT batteries;
- concise flow: map, request, review, snapshot, export;
- boundary statement: “Evidence preparation, not legal certification or authority approval”;
- dated methodology and official-source links;
- sign-in and contact/pilot actions.

**Acceptance:** No claim says that the service creates a legally valid DPP, guarantees conformity, or submits to the EU Registry.

### PUB-002 — Methodology

**Route:** `/methodology`  
**Personas:** Public  
**State:** `MVP`

Shows the supported control snapshot, readiness-state definitions, evidence standards, limitation language, update policy, and changelog. Historic methodology pages remain addressable when an export cites them.

### AUTH-001 — Operator sign-in

**Route:** `/sign-in`  
**Personas:** Workspace users  
**State:** `PILOT`, `MVP`

Supports configured OIDC/passwordless identity, generic error copy, safe return URL, and MFA challenge. It MUST reject open redirects and MUST NOT reveal whether an email belongs to an account.

### AUTH-002 — Accept invitation

**Route:** `/invite/:inviteToken`  
**Personas:** Invited workspace users  
**State:** `MVP`

Displays inviting organization, offered role, token expiry, privacy/terms links, and existing-account sign-in. Acceptance requires verified identity matching policy. Expired, revoked, already-used, and wrong-identity states have distinct recovery actions without exposing workspace data.

## 4. Portfolio and model setup

### DASH-001 — Portfolio dashboard

**Route:** `/w/:workspaceId`  
**Personas:** `EO_ADMIN`, `COMPLIANCE_MANAGER`, `TECHNICAL_APPROVER`  
**State:** `PILOT`, `MVP`

**Primary regions:**

1. portfolio summary: model counts by readiness state and snapshot;
2. attention queue: conflicts, stale evidence, unanswered requests, failed jobs, newer control snapshot;
3. model list: name, product, category, target placement date, selected snapshot, readiness, owner, last activity;
4. recent audited activity.

**Filters:** owner, readiness, category, target-date range, snapshot, archived.  
**Actions:** create model; open model; duplicate model metadata without copying approvals; archive subject to retention rules.

**Empty state:** Explain the model-first workflow and open `MOD-001`.  
**Phone:** Summary becomes text cards; model rows become cards; no readiness chart is required.  
**Acceptance:** A model with any blocking state cannot appear as evidence ready, and totals reconcile with the filtered list.

### MOD-001 — Create battery model

**Route:** `/w/:workspaceId/models/new`  
**Personas:** `EO_ADMIN`, `COMPLIANCE_MANAGER`  
**State:** `PILOT`, `MVP`

**Step 1 — Product identity fields:**

- internal product name and optional SKU/family;
- battery model name and model identifier;
- responsible economic-operator organization;
- market/brand name, optional at draft stage.

**Step 2 — Applicability inputs:**

- battery category, with LMT as the only self-serve MVP choice;
- capacity and unit;
- intended placing-on-market date;
- manufactured/placed-on-market context needed by the supported rules;
- unknown option plus accountable owner where a fact is unavailable.

**Step 3 — Baseline:**

- default supported control snapshot;
- source date and disclaimer;
- count preview: required now, conditional, not yet required, not applicable;
- explicit confirmation that the result is a rules-engine classification, not legal advice.

**Validation:** Stable model identifier unique within workspace; date and numeric units valid; unsupported category routes to assisted pilot or waitlist, never silently maps to LMT.

**Acceptance:** Creation writes the model, immutable scope-evaluation record, selected snapshot, and audit event in one transaction or rolls back.

### MOD-002 — Model overview

**Route:** `/w/:workspaceId/models/:modelId`  
**Personas:** All operator personas with model access  
**State:** `PILOT`, `MVP`

**Regions:**

- `ModelContextBar`;
- evidence-readiness summary by state, with denominator explanation;
- next best actions ordered by blockers, target date, and age;
- scope facts and applicability rationale;
- supplier-request progress;
- latest readiness snapshot and exports;
- source update banner.

**Actions:** edit non-identity scope facts; re-evaluate applicability; assign manager; open matrix; create snapshot when eligible.

Changing a scope fact creates a new scope-evaluation version, displays the before/after applicability diff, invalidates no historical snapshot, and may move current controls to review. The user MUST confirm the impact before commit.

## 5. Data-point matrix and detail

### MAT-001 — Data-point matrix

**Route:** `/w/:workspaceId/models/:modelId/matrix`  
**Personas:** All operator personas with model access; edit actions by capability  
**State:** `PILOT`, `MVP`

**Desktop columns:** number/key, data point, applicability, readiness, approved value summary, evidence, owner, supplier, updated, action.  
**Filters:** state, category/group, owner, supplier, access class, due date, value type, changed since snapshot.  
**Views:** all, blocking, review needed, supplier outstanding, public-passport candidates, restricted.

**Row interaction:**

- single click/Enter opens `MAT-002` in the same route context;
- selection enables assign owner/supplier or request inclusion only;
- bulk approval and bulk “not applicable” are prohibited;
- every state chip exposes its reason.

**Phone:** Card list shows name, state, applicability, owner, due date, and next action. Editing occurs in `MAT-002`.  
**Tablet:** Optional detail drawer; it MUST become a full page at narrow widths.  
**Acceptance:** State totals equal the filtered rows; not-yet-required and not-applicable rows are never counted as evidenced; a control's official source opens at the cited snapshot context.

### MAT-002 — Data-point detail

**Route:** `/w/:workspaceId/models/:modelId/data-points/:controlKey`  
**Personas:** All operator personas with model access  
**State:** `PILOT`, `MVP`

**Header:** official label, internal key, group, source snapshot, applicability/result rationale, readiness state, owner, supplier, due date.

**Tabs/sections:**

1. **Approved claim** — typed value, unit, method, effective/as-of date, reviewer, decision rationale.
2. **Proposals** — supplier/manual/extraction origin, submitter, time, normalized comparison, review action.
3. **Evidence** — exact document version and page/section/bounding location, excerpt, access class, validity dates.
4. **History** — append-only claim and decision timeline.
5. **Source** — official description, applicability expression, update notes, non-authoritative disclaimer.

**Actions by state:**

- `MISSING`: enter proposal, assign, add to request, or upload evidence;
- `PENDING_REVIEW`: approve, reject with reason, request clarification;
- `CONFLICTING`: open `REV-002`;
- `STALE`: supersede evidence or approve continuing validity with a recorded rationale if policy allows;
- `CONDITIONAL`: supply the missing scope fact or record an applicability decision with authority/rationale;
- neutral states: view rationale; authorized user may propose scope correction.

**Acceptance:** Approval requires at least one eligible evidence citation unless the control policy explicitly allows attestation; rejected proposals remain immutable history; edits never overwrite a supplier assertion.

## 6. Suppliers and requests

### SUPP-001 — Supplier ownership

**Route:** `/w/:workspaceId/models/:modelId/suppliers`  
**Personas:** `EO_ADMIN`, `COMPLIANCE_MANAGER`; read-only for `TECHNICAL_APPROVER`  
**State:** `PILOT`, `MVP`

Shows suppliers, contacts, assigned controls, outstanding/late requests, last response, and confidentiality notes. Users may create a supplier record, assign controls, change a request contact, or remove a future assignment. Removing a supplier MUST NOT delete prior submissions or evidence.

Duplicate contact detection is workspace-scoped. Contact consent/lawful-basis administration remains the customer's responsibility and is stated in-product.

### REQ-001 — Request list

**Route:** `/w/:workspaceId/models/:modelId/requests`  
**Personas:** `EO_ADMIN`, `COMPLIANCE_MANAGER`; read-only for approvers  
**State:** `PILOT`, `MVP`

Columns/cards: supplier, contact, request state, requested/submitted counts, due date, last delivery, reminders, sender. Actions: open, duplicate unanswered items into a new request, revoke, extend due date, resend link. Resend rotates or reuses the token according to security policy and never changes submitted content.

### REQ-002 — Request builder

**Route:** `/w/:workspaceId/models/:modelId/requests/new`  
**Personas:** `EO_ADMIN`, `COMPLIANCE_MANAGER`  
**State:** `PILOT`, `MVP`

**Steps:**

1. select supplier and verified contact address;
2. select only applicable/conditional data points assigned to that supplier;
3. configure per-item requested value, allowed unit, requested document, required-for-request flag, and note;
4. set due date, portal language, reminder policy, and optional contact verification;
5. preview exactly what the supplier will see and what classifications apply;
6. send with confirmation.

The builder warns about duplicate open requests, restricted internal notes, unsupported file expectations, and due dates beyond the target date. Sending creates an immutable request version and audit event. The email contains a scoped link, not requested confidential values.

### REQ-003 — Request detail

**Route:** `/w/:workspaceId/requests/:requestId`  
**Personas:** `EO_ADMIN`, `COMPLIANCE_MANAGER`, `TECHNICAL_APPROVER`  
**State:** `PILOT`, `MVP`

Shows request version, recipient, delivery history, token state, progress, responses, documents, clarifications, reminders, receipt, and audit timeline.

**Actions:** revoke link; extend due date; resend; send clarification; accept submission into review; create follow-up for unresolved items. No action may modify the supplier's immutable submitted version.

## 7. Documents, proposals, and conflict review

### DOC-001 — Document library

**Route:** `/w/:workspaceId/documents`  
**Personas:** Operator personas according to document access class  
**State:** `PILOT`, `MVP`

Filters: model, supplier, type, classification, extraction state, malware state, validity, referenced/unreferenced. Columns/cards: safe display name, source, version, class, models, uploaded, extraction, references.

Upload requires model/source/classification/document type and supports an optional validity period. Malware scanning precedes preview or extraction. Quarantined documents show safe metadata only and cannot be downloaded except through authorized security operations.

### DOC-002 — Document and evidence detail

**Route:** `/w/:workspaceId/documents/:documentId`  
**Personas:** Authorized operator personas  
**State:** `PILOT`, `MVP`

**Desktop/tablet landscape:** document viewer plus evidence/proposal side panel.  
**Phone/tablet portrait:** alternating accessible viewer and detail tabs.

Shows immutable version, hash, origin, uploader, upload time, scan/extraction status, classification, validity, derived text status, claims citing it, and version history. An evidence citation records page/section/location; annotations never alter the original.

Extraction actions are `MVP/GATE`: run, retry, inspect proposal, accept into review, or discard with reason. Low-confidence output is visually distinct but confidence never substitutes for review.

### REV-001 — Review queue

**Route:** `/w/:workspaceId/review`  
**Personas:** `EO_ADMIN`, `COMPLIANCE_MANAGER`, `TECHNICAL_APPROVER`  
**State:** `PILOT`, `MVP`

Queue items include proposal, conflict, expiring evidence, scope decision, and failed extraction. Filters include assigned reviewer, model, type, age, due date, supplier, and confidence band.

The review panel displays control/source context, existing approved claim, incoming proposal, evidence citation, origin, normalization, and changes. Actions require a reason when rejecting, overriding, resolving conflict, or accepting a material unit/method difference.

Keyboard shortcuts MAY navigate but MUST never approve/reject without an explicit focused confirmation. “Approve and next” remains one audited decision plus navigation.

### REV-002 — Conflict resolution

**Route:** `/w/:workspaceId/conflicts/:conflictId`  
**Personas:** Authorized approvers  
**State:** `PILOT`, `MVP`

Displays every active assertion side by side: raw value, normalized value, unit, method, as-of date, source, supplier, evidence, and review history. Resolution choices:

- select one assertion as approved;
- create a new operator-authored claim supported by cited evidence;
- request clarification and leave unresolved;
- mark a superseded assertion, preserving history.

A conflict cannot be dismissed without outcome, actor, timestamp, and rationale. If source methods or dates are not comparable, the screen says so instead of declaring a winner.

## 8. Readiness snapshots, exports, and shares

### SNP-001 — Snapshot history

**Route:** `/w/:workspaceId/models/:modelId/snapshots`  
**Personas:** All operator personas with model access  
**State:** `PILOT`, `MVP`

Lists snapshot ID, control snapshot, scope version, creator, created time, state counts, readiness verdict, superseding snapshot, and exports. Historical snapshots are immutable and remain viewable after source updates or model changes.

### SNP-002 — Snapshot preflight

**Route:** `/w/:workspaceId/models/:modelId/snapshots/new`  
**Personas:** `EO_ADMIN`, `COMPLIANCE_MANAGER`, `TECHNICAL_APPROVER`  
**State:** `PILOT`, `MVP`

**Preflight checks:**

- model identity and scope version fixed;
- supported control snapshot fixed;
- every applicable item classified;
- no missing, conflicting, stale, pending-review, or unresolved conditional item for `EVIDENCE_READY`;
- every approved claim has required eligible evidence;
- no referenced file is quarantined, deleted, or unauthorized;
- warnings for newer official source, expiring evidence, and unresolved non-blocking notes;
- public/restricted classification summary.

If blockers exist, creation may still produce a `BLOCKED` or `REVIEW_NEEDED` snapshot for internal progress, but copy MUST make the outcome explicit. User enters purpose and optional note, reviews a manifest, and confirms. Snapshot creation is idempotent.

### EXP-001 — Exports and external shares

**Route:** `/w/:workspaceId/models/:modelId/exports`  
**Personas:** `EO_ADMIN`, `COMPLIANCE_MANAGER`; approvers view existing outputs  
**State:** `PILOT`, `MVP`

**Export builder fields:** source readiness snapshot, profile/version, included classes, file format, recipient/purpose, expiration, evidence attachment option, redaction preview.

**Outputs:** versioned JSON/CSV manifest and optional evidence bundle. PDF summary is `LATER/GATE` until accessible generation is verified. Every output includes model/snapshot IDs, timestamps, source/control version, verdict, unresolved states, schema version, hashes, and limitation text.

**Share builder:** choose immutable snapshot/export, named reviewer or token access, permitted evidence classes, download permission, expiry, and optional access-code verification. Show an exact disclosure preview before issuance.

**Actions:** download, verify checksum, inspect manifest, create/revoke share, view access log. Revocation blocks future access but does not claim to erase an earlier download.

## 9. Audit and settings

### AUD-001 — Audit history

**Route:** `/w/:workspaceId/audit`  
**Personas:** `EO_ADMIN`; managers read workflow events; approvers see scoped events  
**State:** `MVP`

Filters: time, actor, event family, object, model, request, result. Events show safe metadata, reason, correlation ID, and before/after references where permitted. Raw tokens, secrets, full document text, and unnecessary personal data are never displayed or exported.

### SET-001 — Organization

**Route:** `/w/:workspaceId/settings/organization`  
**Persona:** `EO_ADMIN`  
Fields: legal/display name, business identifiers where needed, locale, time zone, notification sender label, default classification. Changing identity-critical fields requires re-authentication and audit.

### SET-002 — Members and roles

**Route:** `/w/:workspaceId/settings/members`  
**Persona:** `EO_ADMIN`  
Invite, resend, change role, suspend, remove. Prevent removal/demotion of the last active admin. Role-change impact and currently assigned work are previewed.

### SET-003 — Security

**Route:** `/w/:workspaceId/settings/security`  
**Persona:** `EO_ADMIN`  
Shows MFA/SSO policy, active sessions, supplier/reviewer link defaults, support grants, security-event destinations, and recent sensitive events. Secrets are write-only. `LATER/GATE` settings are visible only when actionable.

### SET-004 — Retention and deletion

**Route:** `/w/:workspaceId/settings/retention`  
**Persona:** `EO_ADMIN`  
Shows configured retention, legal-hold behavior, pending deletions, data export, and tenant-deletion workflow. Destructive changes show affected object counts, recovery period if any, irreversible consequences, re-authentication, and typed confirmation. Audit integrity requirements may preserve minimal event records under the disclosed policy.

### SET-005 — Integrations

**Route:** `/w/:workspaceId/settings/integrations`  
**Persona:** `EO_ADMIN`  
**State:** `LATER/GATE`

Displays only validated integrations: email intake, outbound webhooks, identity, storage/export destinations, and passport-publisher profiles. Each connection shows scopes, owner, last success, failures, rotation/revoke controls, and test action. No direct DPP Registry submission is represented unless a later validated requirement and implementation authorize it.

### SET-006 — Plan and usage

**Route:** `/w/:workspaceId/settings/plan`  
**Persona:** `EO_ADMIN`  
**State:** `MVP`

Shows customer plan, included/used operator seats, active models, storage/processing usage, billing contact, invoices/receipts when supported, and clear upgrade/contact actions. Supplier contributors and reviewer shares never consume a paid operator seat or encounter a payment gate while completing an authorized request/review. Usage values link to their measurement definitions and lag disclosure.

## 10. Operator end-to-end acceptance

1. An admin can create an LMT battery model, see the exact control snapshot and applicability result, and assign unresolved points.
2. A manager can send a supplier request whose preview exactly matches the supplier-visible scope.
3. An approver can trace a proposal to an immutable supplier response and exact document location before deciding.
4. A conflict blocks evidence readiness until an authorized, reasoned resolution is recorded.
5. A source or scope update never changes a historical readiness snapshot.
6. An export or share discloses only previewed classifications and is reproducible from its immutable snapshot.
7. A phone user can inspect status, upload evidence, decide one proposal, monitor/revoke requests, and revoke a share.
8. Tablet layouts support full primary operator workflows without off-screen actions or desktop-only hover behavior.
9. Tenant boundaries, role permissions, re-authentication, and sensitive audit events are enforced server-side.
10. No operator screen labels the model, organization, evidence, or output as legally compliant, certified, approved, or registered.
