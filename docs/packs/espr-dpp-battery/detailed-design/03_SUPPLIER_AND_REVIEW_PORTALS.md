# 03 — Supplier and External Reviewer Portals

## 1. Design intent

These portals let outsiders complete a narrow job without exposing the operator workspace. A link is a scoped principal, not merely a hidden URL. Supplier content is an assertion until an authorized operator reviews it; reviewer access is read-only and limited to an immutable disclosure.

Both portals inherit the responsive, accessibility, trust, content, and universal-state rules in [01_EXPERIENCE_FOUNDATIONS.md](01_EXPERIENCE_FOUNDATIONS.md).

## 2. Link and identity contract

### 2.1 Token requirements

- Store only a non-reversible token digest.
- Bind the token to one tenant, purpose, object/version, capability set, and expiry.
- Use at least 128 bits of cryptographically random entropy.
- Never place the token in logs, analytics, page titles, referrers, support screenshots, or third-party URLs.
- Set `Referrer-Policy: no-referrer`, restrictive CSP, `Cache-Control: no-store`, secure cookies, and no third-party analytics on portal pages.
- Rate-limit validation and return generic invalid-link responses.
- Rotate on suspected disclosure and revoke immediately on request.
- Require optional email/access-code verification when configured or when the disclosure policy demands it.

### 2.2 Link states

| State | Supplier behavior | Reviewer behavior |
| --- | --- | --- |
| Valid | Open scoped object | Open scoped immutable disclosure |
| Expired | Preserve server draft if policy permits; request a new link | Deny and identify operator contact channel |
| Revoked | Deny; do not reveal later request state | Deny; explain that access was withdrawn |
| Already submitted | Open receipt/status, not editable submission | Not applicable |
| Wrong verified identity | Deny and offer identity switch | Deny and offer identity switch |
| Object superseded | Show receipt and follow-up request if issued | Show disclosed immutable version and superseded label |
| Invalid/unknown | Generic unavailable message | Generic unavailable message |

An operator can revoke future access, but the product MUST NOT imply it can retract a file already downloaded.

## 3. Supplier request flow

### SUP-001 — Access and request introduction

**Route:** `/s/r/:requestToken`  
**Principal:** `SUPPLIER_CONTRIBUTOR`  
**State:** `PILOT`, `MVP`

**Purpose:** Establish trust and scope before requesting information.

**Required content:**

- requesting legal/display organization;
- battery/product context explicitly disclosed in the request;
- named operator contact or managed reply channel;
- number of requested items and due date;
- supported language selector;
- why the information is requested and how it will be used;
- privacy, retention, confidentiality, and limitation links;
- whether email/access-code verification is required;
- “Continue,” “I am not the right contact,” and report-link concern actions.

No requested value or document name appears before successful link validation. “Wrong contact” collects an optional replacement contact only with an explicit confirmation and sends it to the operator for approval; it does not automatically forward access.

**Acceptance:** The page is fully usable at 320 CSS px, makes the requesting organization identifiable, and reveals no other supplier, request, model, or workspace information.

### SUP-002 — Request overview

**Route:** `/s/r/:requestToken?step=overview`  
**Principal:** Valid supplier token  
**State:** `PILOT`, `MVP`

Shows:

- request version and due date;
- requested data points grouped by topic;
- each item's required-for-request/optional label;
- expected value type, unit, document, and operator note;
- progress: not started, draft, needs attention, complete;
- estimated effort based on item count, explicitly labeled as an estimate;
- save/resume and contact actions.

The request-level “required” label means required to submit this request, not a universal statement of regulatory applicability. This distinction appears inline.

### SUP-003 — Data entry

**Route:** `/s/r/:requestToken?step=data&item=:itemKey`  
**Principal:** Valid supplier token  
**State:** `PILOT`, `MVP`

**Per-item fields:**

- requested label and plain-language help;
- official/source context when safe and relevant;
- typed value control and explicit unit;
- as-of/effective date;
- measurement/calculation method or standard where requested;
- response status: value supplied, unavailable, unknown, not applicable, needs clarification;
- explanation/rationale;
- evidence selection or upload;
- confidentiality classification proposed by supplier;
- supplier reference/version number.

**Interaction rules:**

- Autosave drafts after an idle interval and on navigation; show “Saved at” time.
- Offline edits remain visibly local and retry after reconnection; submission is unavailable offline.
- Conversions show original and normalized values; the original is preserved.
- Choosing unavailable/unknown/not applicable requires an explanation when operator policy says so and never invents a value.
- The supplier may revisit any item until final submission.
- Operator clarification appears as a dated thread scoped to the item; email notifications contain no confidential response text.

**Acceptance:** Reloading or using browser back does not lose an acknowledged draft; raw supplier values remain unchanged by normalization; field errors are summarized and linked.

### SUP-004 — Document upload

**Route:** `/s/r/:requestToken?step=documents`  
**Principal:** Valid supplier token  
**State:** `PILOT`, `MVP`

**Fields:** file, safe display name, document type, version/date, validity end if known, related requested items, language, proposed confidentiality class, note.

**Required behavior:**

- standard file-picker plus optional drag/drop and phone camera/photo access;
- pre-upload type/size guidance;
- resumable or recoverable upload for supported sizes;
- filename normalization while preserving safe original metadata;
- server-side malware scan before preview/extraction;
- checksum and immutable version creation;
- orientation-aware image/PDF preview;
- explicit delete-before-submit action and supersede-after-submit workflow;
- quarantine state that gives a safe retry/contact path.

The UI MUST say that upload does not mean acceptance. OCR/extraction, if enabled, is an operator aid and does not silently populate the supplier's answers.

### SUP-005 — Review and submit

**Route:** `/s/r/:requestToken?step=review`  
**Principal:** Valid supplier token  
**State:** `PILOT`, `MVP`

Displays the exact immutable submission preview:

- requesting organization, request version, submitter identity/contact;
- every answer including unknown/unavailable/not-applicable;
- original units and methods;
- included documents, versions, hashes/receipts, and classifications;
- unresolved optional and required-for-request items;
- supplier declaration text configured for the request;
- privacy/retention notice version.

Required-for-request omissions block submission with links to the fields. Submission requires an unchecked acknowledgment and an explicit “Submit responses” action. The system uses an idempotency key; retries cannot create duplicate submissions.

If the supplier needs to correct a submitted answer, it requests reopening or responds to a new follow-up version. The original submission remains immutable.

### SUP-006 — Receipt and status

**Route:** `/s/r/:requestToken?step=receipt`  
**Principal:** Submitted supplier token  
**State:** `PILOT`, `MVP`

Shows submission ID, request/submission versions, received timestamp, item/document counts, operator contact, and printable/downloadable receipt without embedding unrestricted evidence. It states: “Received for review; not yet accepted or approved.”

Later status may show received, clarification requested, or closed. It MUST NOT expose internal reviewer notes, other assertions, conflicts, readiness verdicts, or operator exports.

## 4. Supplier exceptional states

| Condition | Required response |
| --- | --- |
| Due date passed, link valid | Allow submission unless operator disabled it; mark late |
| Session expires mid-entry | Preserve draft, revalidate link, restore safely |
| Request revoked during edit | Stop new writes; preserve server draft under retention policy; show contact path |
| Request changed | Never mutate current version; operator issues a new version/follow-up |
| Concurrent tabs | Detect version conflict and show compare/reload; never last-write-wins silently |
| Upload interrupted | Resume when supported or retry without duplicate document versions |
| Malware detected | Quarantine; do not preview or expose detection details useful for abuse |
| Unsupported format | Retain form state and identify accepted alternatives |
| Required answer unavailable | Permit explicit unavailable only if request policy allows; otherwise contact operator |
| Accessibility timeout risk | Warn, extend, and preserve draft |

## 5. External reviewer flow

### EXT-001 — Disclosure summary

**Route:** `/review/:shareToken`  
**Principal:** `REVIEWER` through restricted share or invited identity  
**State:** `MVP`

**Purpose:** Show exactly what the operator shared, why, and for how long.

**Required content:**

- sharing organization and contact;
- product/battery model identifiers included in the share;
- immutable readiness snapshot ID and creation time;
- control snapshot key/date and methodology link;
- readiness verdict and state counts;
- unresolved/missing/conflicting/stale items included in the disclosure;
- share purpose, expiry, permitted access classes, and download policy;
- explicit limitation: evidence-preparation status, not certification, authority approval, or Registry status.

If the source snapshot is superseded, show that status and the operator-provided route to request an updated share. Never silently redirect to a newer snapshot.

### EXT-002 — Claim and evidence detail

**Route:** `/review/:shareToken/data-points/:controlKey`  
**Principal:** Valid reviewer share with item permission  
**State:** `MVP`

Displays only disclosed fields:

- data-point name and applicability rationale;
- approved claim, unit, method, and as-of date;
- exact permitted evidence citations;
- document version/hash and redaction/classification label;
- reviewer-visible decision provenance;
- source snapshot and limitation.

Reviewer actions are view, navigate, and download when granted. No annotation is implied to enter the operator's official audit trail in MVP. A feedback channel, if offered later, is a separate proposed comment workflow.

Evidence previews MUST enforce authorization on every range/file request; obscuring a link in the UI is insufficient. Redacted derivatives are distinct immutable objects with their own hash and provenance.

### EXT-003 — Downloads and access status

**Route:** `/review/:shareToken/downloads`  
**Principal:** Valid reviewer share  
**State:** `MVP`

Lists only permitted export/evidence artifacts with format, size, created time, hash, classification, and download availability. Before a restricted download, show purpose and classification and require acknowledgment when policy demands it.

Expired/revoked access blocks new preview and download. The page provides a contact route but reveals no current internal state. Access events are recorded with minimized network/client metadata under the retention policy.

## 6. External portal privacy and accessibility acceptance

1. Portal URLs and tokens never reach analytics, crash-report payloads, referrer headers, support logs, or email-link scanners beyond the minimum validation design.
2. A supplier can complete, save, upload, review, and submit at 320 px and with keyboard/screen reader operation.
3. A reviewer sees exactly the disclosure preview approved by an operator—no current/live model data and no disallowed evidence class.
4. Refresh, back/forward, connection loss, and ordinary session expiry do not destroy acknowledged supplier drafts.
5. Supplier submission, operator reopening, reviewer download, expiry, and revocation are server-authorized and audited.
6. Original answers/documents and their versions remain immutable after submission; corrections create new versions.
7. Portal emails contain scoped links and non-sensitive context, not confidential answer values or attachments by default.
8. Neither portal represents receipt, review, download, or evidence readiness as legal compliance or authority approval.
