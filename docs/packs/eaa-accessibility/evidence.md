# Evidence expectations — `eaa-accessibility`

What an approved claim needs before a control can be `EVIDENCED`. Extraction may
propose; an authorized human approves (engine principle: extraction is not
verification). Automated scan results alone never satisfy a WCAG success
criterion — they cover roughly a third of the checkpoints.

## By field family

| Field family | Acceptable evidence (at least one, plus a human review record) | Not sufficient alone |
| --- | --- | --- |
| `web-sc-check` (EN 301 549 ch. 9) | Manual audit record naming the tester, method, pages/components, date, and result per success criterion; supported by automated scan output (axe/Lighthouse/WAVE) and, for interaction SC, assistive-technology test notes (screen reader + keyboard) | An automated scan with "0 violations"; an overlay-widget report |
| `doc-sc-check` (ch. 10) | Per-document conformance check against the WCAG-to-PDF/EPUB techniques; checker output (e.g. PAC, Ace) plus manual review | Filensname/extension; "made in an accessible tool" |
| `sw-sc-check` (ch. 11) | Platform accessibility-inspector output (Accessibility Scanner / Xcode Accessibility Inspector) plus screen-reader (TalkBack/VoiceOver) test notes; date, build/version | Store listing text |
| `hardware-check` (ch. 5, 8) | Test report against the specific EN 301 549 hardware clauses; photos/measurements; model and firmware version; or a supplier declaration (see below) tied to that model | A generic brochure claim |
| `presence-check` / `document-presence` | The actual artefact (support page, statement, procedure) captured as an immutable document with its URL and retrieval date | A link that 404s or is not public |
| `outcome-attestation` | A named approver's attestation referencing the underlying SC evidence for that functional-performance outcome | An unsupported "yes" |
| `assessment-record` | The completed disproportionate-burden / fundamental-alteration assessment (EAA Annex VI criteria), signed, dated, with the cost/benefit reasoning and the specific requirements it covers | A statement that burden "is disproportionate" |
| `attestation` (CE marking) | Photo/record of the marking on the product or packaging plus the linked EU declaration of conformity | — |

## Supplier / agency contributions (contributor portal)

- **VPAT / Accessibility Conformance Report (ACR)** from a component or platform
  supplier: accepted as evidence for the controls it explicitly addresses, tagged
  origin `SUPPLIER_ASSERTION`, tied to the exact product/version. A reviewer must
  confirm the ACR's scope matches the entity's use.
- **Third-party audit report** from an accessibility agency: accepted as
  `SUPPLIER_ASSERTION` evidence; the audit's page/flow scope and date are recorded
  as the evidence location.
- Neither is auto-approved. Both can be superseded by a newer report.

## Staleness rules

| Trigger | Effect |
| --- | --- |
| Audit or scan older than the customer-configured interval (default 12 months) | control → `STALE` |
| A release/deploy to the audited surface after the audit date | affected controls → `STALE` |
| Disproportionate-burden assessment older than 5 years | `EAA-PROC-DISPROPORTIONATE-BURDEN` → `STALE`, dependent controls revert to blocking |
| EN 301 549 / WCAG snapshot change requiring a new SC | affected controls → `STALE` under the new snapshot |
| Supplier relationship for a cited component ended | that ACR-backed control → `STALE` |
