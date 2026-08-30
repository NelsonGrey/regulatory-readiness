# 01 — Experience Foundations

## 1. Experience promise

Passport Inbox should make a complicated evidence project feel controlled without making it look deceptively complete. At any moment, an authorized user should be able to answer:

- What battery model and control snapshot am I looking at?
- Which information is required, conditional, not yet required, or not applicable?
- Who owns each unresolved item?
- What exact source supports an approved value?
- What changed, who approved it, and what remains blocked?
- What will leave the workspace if I export or share?

## 2. Persona and principal model

| Principal | Authentication | Default landing | Scope |
| --- | --- | --- | --- |
| `EO_ADMIN` | Workspace identity, MFA required | `DASH-001` | Entire tenant and administration |
| `COMPLIANCE_MANAGER` | Workspace identity | `DASH-001` | Entire assigned tenant workflow |
| `TECHNICAL_APPROVER` | Workspace identity | `REV-001` | Assigned models/reviews; no user/billing administration |
| `REVIEWER` | Invited identity or restricted share | `EXT-001` | One shared snapshot/export and allowed evidence |
| `SUPPLIER_CONTRIBUTOR` | Expiring request token; optional verification | `SUP-001` | One request and its drafts/submissions |
| `PLATFORM_SUPPORT` | Platform identity plus active customer grant | Contextual diagnostics | Explicit time-bound customer-granted scope |

The UI MUST never use a role to imply legal authority. For example, “Technical Approver” means authorized inside the customer workspace, not approved by an EU authority.

## 3. Capability model

| Capability | Admin | Manager | Approver | Reviewer | Supplier |
| --- | ---: | ---: | ---: | ---: | ---: |
| View portfolio/models | Yes | Yes | Assigned/all by policy | Shared only | Request context only |
| Edit model facts | Yes | Yes | Proposed correction only | No | No |
| Assign control owner | Yes | Yes | No | No | No |
| Send/cancel request | Yes | Yes | No | No | No |
| Upload evidence | Yes | Yes | Yes | No | Request only |
| Review claim | Yes | Yes | Yes | No | No |
| Resolve conflict | Yes | Yes | Yes | No | Clarification only |
| Create snapshot | Yes | Yes | Yes | No | No |
| Export/share | Yes | Yes | No | Granted action only | Receipt only |
| Manage users/security | Yes | No | No | No | No |

Disabled controls MUST explain the missing permission. Hidden controls are preferred when the action is irrelevant; disabled controls are preferred when understanding the workflow benefits the user.

## 4. Core mental model

```text
Organization
  └─ Product
      └─ Battery model
          ├─ Selected control snapshot
          ├─ Control/data-point rows
          │    ├─ applicability result
          │    ├─ owner/supplier assignment
          │    ├─ claims and revisions
          │    ├─ exact evidence locations
          │    ├─ review decisions/conflicts
          │    └─ current readiness state
          ├─ Supplier requests/submissions
          ├─ Readiness snapshots
          └─ Exports and external shares
```

Users should not have to understand the database. Navigation and copy consistently use “battery model,” “data point,” “request,” “document,” “proposed value,” “approved claim,” “evidence,” “snapshot,” and “export.”

## 5. Information architecture

### 5.1 Public/authentication

- `/` — product boundary and sign-in link (`PUB-001`)
- `/methodology` — readiness-state and source explanation (`PUB-002`)
- `/sign-in` — operator sign-in (`AUTH-001`)
- `/invite/:inviteToken` — workspace invitation (`AUTH-002`)

### 5.2 Operator application

- `/w/:workspaceId` — portfolio dashboard (`DASH-001`)
- `/w/:workspaceId/models/new` — model creation (`MOD-001`)
- `/w/:workspaceId/models/:modelId` — model overview (`MOD-002`)
- `/w/:workspaceId/models/:modelId/matrix` — data-point matrix (`MAT-001`)
- `/w/:workspaceId/models/:modelId/data-points/:controlKey` — data-point detail (`MAT-002`)
- `/w/:workspaceId/models/:modelId/suppliers` — supplier ownership (`SUPP-001`)
- `/w/:workspaceId/models/:modelId/requests` — request list (`REQ-001`)
- `/w/:workspaceId/models/:modelId/requests/new` — request builder (`REQ-002`)
- `/w/:workspaceId/requests/:requestId` — request detail (`REQ-003`)
- `/w/:workspaceId/documents` — document library (`DOC-001`)
- `/w/:workspaceId/documents/:documentId` — document/evidence detail (`DOC-002`)
- `/w/:workspaceId/review` — review queue (`REV-001`)
- `/w/:workspaceId/conflicts/:conflictId` — conflict resolution (`REV-002`)
- `/w/:workspaceId/models/:modelId/snapshots` — snapshot history (`SNP-001`)
- `/w/:workspaceId/models/:modelId/snapshots/new` — snapshot preflight (`SNP-002`)
- `/w/:workspaceId/models/:modelId/exports` — exports/shares (`EXP-001`)
- `/w/:workspaceId/audit` — audit history (`AUD-001`)
- `/w/:workspaceId/settings/*` — organization, members, security, retention, integrations, and plan (`SET-001` through `SET-006`)

### 5.3 External portals

- `/s/r/:requestToken` — supplier request (`SUP-001` through `SUP-006`)
- `/review/:shareToken` — reviewer share (`EXT-001` through `EXT-003`)

## 6. Navigation contract

### 6.1 Desktop/laptop

- Persistent left navigation: Portfolio, Review, Documents, Audit.
- Workspace switcher and Settings at the bottom.
- Model pages add a secondary horizontal/tab navigation: Overview, Matrix, Suppliers, Requests, Snapshots, Exports.
- Breadcrumbs show workspace > product > model > current object.

### 6.2 Tablet browser

- Collapsible navigation rail, default collapsed below 1024 px.
- Model tab row scrolls horizontally with visible end fade and keyboard support.
- Split panes become 40/60 or stacked depending on width and content.

### 6.3 Phone browser

- Top app bar with workspace/model title and menu button.
- Bottom navigation: Portfolio, Review, Documents, More.
- Model subnavigation appears as an accessible select/sheet, not a crushed tab row.
- Tables become card lists or a field-focused drill-down; critical columns must not rely on horizontal scrolling.

## 7. Responsive layout contract

| Class | Reference width | Behavior |
| --- | ---: | --- |
| Phone narrow | 320–389 px | Single column, 16 px gutters, sticky primary action where safe |
| Phone wide | 390–599 px | Single column, compact summaries, bottom sheets |
| Tablet portrait | 600–899 px | One or two columns by task; collapsible rail |
| Tablet landscape/small laptop | 900–1199 px | Two-pane review where practical |
| Desktop | 1200–1599 px | Persistent nav, dense matrix, 2–3 pane workflows |
| Wide desktop | 1600 px+ | Content max-width; do not stretch text/forms indefinitely |

Required manual coverage:

- iPhone-sized Safari, portrait and landscape where forms support it;
- iPad-sized Safari, portrait and landscape;
- Android phone Chrome;
- Android tablet Chrome;
- desktop Chrome/Edge, Firefox, and Safari.

The MVP is responsive web, not a claim of native-app support.

## 8. Readiness visual language

Readiness MUST use text, icon, and color together.

| State | User label | Visual intent | Primary action |
| --- | --- | --- | --- |
| `EVIDENCED` | Evidenced | Positive, restrained | View approved claim |
| `MISSING` | Missing | Blocking | Assign or request |
| `CONFLICTING` | Conflict | Blocking/attention | Resolve conflict |
| `STALE` | Stale | Blocking/time | Replace or re-approve |
| `PENDING_REVIEW` | Review needed | Work queue | Review proposal |
| `CONDITIONAL` | Needs scope decision | Question/attention | Supply fact or rationale |
| `NOT_YET_REQUIRED` | Not required for this snapshot | Neutral | View source explanation |
| `NOT_APPLICABLE` | Not applicable | Neutral | View rationale |

No all-green “compliant” banner is permitted. `EVIDENCE_READY` appears as “Evidence ready for snapshot EC-BP-2026-08-15” followed by the limitation: “This is a preparation status, not certification or authority approval.”

## 9. Shared component inventory

| Component | Contract |
| --- | --- |
| `SnapshotBadge` | Snapshot key, date, newer-source indicator, source link |
| `ReadinessChip` | State label, icon, reason popover; never color-only |
| `ModelContextBar` | Product/model/category/target date/snapshot always visible on model work |
| `ControlRow` | Data-point number/name, applicability, state, owner, source, last change, action |
| `EvidenceCitation` | Document name, location, excerpt, classification, open action |
| `ClaimComparison` | Current approved versus incoming proposal with units/method/source |
| `ConflictPanel` | All active claims, normalized comparison, resolution actions |
| `AccessClassBadge` | Public candidate/restricted/authority/internal/supplier confidential |
| `SourceDisclaimer` | Dated source and non-authoritative/legal limitation |
| `JobStatus` | Queued/running/succeeded/failed plus retry/support path |
| `AuditTimeline` | Actor, action, time, target, reason; expandable safe metadata |
| `DestructiveConfirm` | Impact preview, re-authentication where required, typed confirmation for tenant deletion |
| `UnsavedChangesGuard` | In-app route, browser close, and session-expiry protection |

## 10. Form and data-entry rules

- Labels remain visible; placeholders are examples, not labels.
- Units are explicit selectors or suffixes and stored separately from numeric value.
- Locale formatting may display commas/decimals appropriately, but canonical stored values are unambiguous.
- Unknown, unavailable, and not applicable are explicit responses, not blank strings.
- Required-for-request is distinct from required-by-snapshot.
- Errors appear next to fields and in a focusable summary.
- Supplier-provided content is shown as untrusted assertion until reviewed.
- Long-running save/upload/extraction actions show recoverable progress.
- Autosave is allowed for drafts but never for approval, submission, snapshot, export, or destructive actions.

## 11. Universal states

Every applicable screen MUST define:

- loading skeleton or progress;
- first-use empty state with a single next action;
- filtered empty state with clear reset;
- inline validation error;
- permission denied without revealing target existence;
- offline/interrupted state with retained draft when safe;
- session expiry and re-authentication;
- asynchronous job queued/running/failed/succeeded;
- source snapshot outdated;
- deleted/archived object;
- feature unavailable due to `GATE`.

## 12. Accessibility contract

`MVP/GATE` until independently verified.

- WCAG 2.2 AA design intent.
- Full keyboard operation and visible focus.
- Semantic headings, landmarks, lists, tables, and forms.
- Table/card alternatives preserve relationships on phone.
- Status changes use polite live regions; critical failures use assertive announcements sparingly.
- File-upload areas include standard button/input operation, not drag-and-drop only.
- Evidence highlights have text/location alternatives.
- Charts always have tables or text summaries.
- Minimum 44 by 44 CSS-pixel touch targets where controls are isolated.
- Zoom to 200% without loss of action or information; reflow at 320 CSS px.
- Timeouts warn and allow extension; supplier drafts survive ordinary expiry where contractually allowed.
- PDFs generated for customer use require tagged, readable output or an accessible HTML equivalent; no conformance claim until tested.

## 13. Trust, safety, and content contract

- Every regulatory statement shows a source/snapshot date.
- The Commission guidance disclaimer is reachable from each matrix and snapshot.
- AI-extracted content is labeled “Proposed from document” with source.
- Audit and history never expose raw access tokens.
- Email messages avoid confidential values and direct attachments by default.
- Download actions show classification and may require confirmation.
- External links identify destination and do not imply endorsement.
- Support access displays an active banner to customer admins/managers.
- Product analytics must not capture document text, claim values, supplier responses, or filenames containing sensitive information.

## 14. Localization and formatting

- English is the MVP UI language, but every UI string and email template is localizable.
- Store timestamps in UTC; display workspace locale/time zone.
- Store canonical units and display approved unit choices.
- Preserve source-language text; extracted translation is a derivative and never replaces original evidence.
- Supplier request language is selected per request/recipient; unsupported languages fall back visibly to English.

## 15. Cross-platform acceptance baseline

1. All primary operator workflows are usable on tablet and desktop.
2. Supplier request completion is fully usable at 320 px width.
3. Operator phone support includes status review, document upload, proposal decision, request monitoring, and urgent link revocation; bulk matrix editing MAY direct users to a wider screen but MUST remain readable.
4. No action relies on hover.
5. Browser back/forward preserves safe navigation and warns on unsaved drafts.
6. Opening a shared link in an in-app email browser provides a supported handoff or clear “open in browser” instruction.
7. Uploaded photos preserve orientation and allow quality review before submission.
