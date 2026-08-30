# Regulatory Readiness Engine — Business Requirements

**Document type:** Business Requirements Document (BRD)
**Version:** 0.1
**Status:** Proposed / discovery
**Last updated:** August 30, 2026
**Owner:** Mark Nelson

Related documents: [ENGINE_CONCEPT.md](../ENGINE_CONCEPT.md), [Technical Requirements](TECHNICAL_REQUIREMENTS.md), [Detailed Design](detailed-design/README.md). Vertical-neutral; regulation specifics live in [control packs](../packs/).

> The Regulatory Readiness Engine prepares and organizes the evidence an organization needs to demonstrate readiness for a specific regulation. It does not provide legal advice, conformity assessment, certification, guaranteed compliance, or submission to any authority.

---

## 1. Executive summary

Many regulations impose the same operational burden regardless of subject matter: decompose the rules into concrete required items, work out which apply, assign each to an internal owner or an outside party, collect values and documents, reconcile contradictions, decide which version is current, prove where each value came from, and hand a traceable package to an auditor, authority, customer, or filing system — then repeat when the rules change.

Point solutions exist per regulation, and enterprise platforms exist for large organizations. The underserved layer is affordable, multi-regulation **evidence readiness with honest provenance** for small and mid-size organizations.

The engine addresses that layer. It is one reusable platform plus a library of **control packs**, each encoding one regulation as a dated, versioned catalog of controls with applicability rules, evidence expectations, validators, and export profiles. The commercial entry is a paid, concierge-assisted readiness sprint per regulation, not an unvalidated self-serve subscription. The first pack is EU Accessibility Act readiness; the origin design pack is the EU battery passport.

## 2. Problem statement

### 2.1 Customer problem

Organizations subject to a regulation typically receive the underlying information as:

- vendor and partner PDFs, reports, and declarations;
- spreadsheets with inconsistent field names and units;
- statements buried in email threads;
- data split across engineering, procurement, operations, legal, and quality staff;
- third-party portals that do not export cleanly;
- documents with no explicit link to the affected entity, batch, site, or validity period.

The responsible organization therefore cannot answer basic readiness questions confidently: which items apply, who owns each answer, whether a value is an assertion or a measurement, which document supports it, whether two sources agree, whether evidence is current, which items are due now versus later, and whether the data can be handed to the next system without repeating the whole exercise.

### 2.2 Business consequences

Unstructured preparation can produce: inability to place a product or service on the market on schedule; delayed launches or holds; emergency consulting and escalation; unsupported or contradictory claims; rework when guidance or schemas change; dependence on one employee, consultant, or vendor; exposure of confidential information to the wrong party; and weak evidence when an authority, auditor, customer, or partner asks for support.

### 2.3 Opportunity statement

Provide a vendor-neutral evidence-readiness system that coordinates internal teams and outside parties before data enters a public or regulated infrastructure — reusable across regulations on shared infrastructure.

## 3. Product vision and positioning

### 3.1 Vision

Every regulated value should have an identifiable owner, an applicability basis, a current source, an approval history, and an honest readiness state.

### 3.2 Positioning statement

For small and mid-size organizations that must prepare information for a regulation, the Regulatory Readiness Engine collects evidence from internal owners and outside parties, maps it to versioned requirements, and produces a reviewable export. Unlike single-regulation point tools, generic document repositories, or enterprise data platforms, it makes missing information, contradictions, provenance, and source changes explicit before publication — and does so for multiple regulations on one platform.

### 3.3 Category

Preferred category: **regulatory evidence readiness**. Adjacent: supplier data collection, product compliance operations, GRC, product information management, document intelligence, supply-chain traceability.

### 3.4 Product principles

1. **Evidence is not the same as a claim.** Store both and preserve the relationship.
2. **Extraction is not verification.** AI and OCR create proposals; authorized humans accept or reject them.
3. **Applicability is versioned.** A control's status depends on entity classification, effective date, and source snapshot.
4. **Uncertainty remains visible.** Missing, conflicting, stale, and review-pending states never become green by averaging.
5. **Outside parties should not need training or another account.** A scoped request link should be sufficient.
6. **Confidentiality follows the control and the evidence.** Public-facing data and restricted technical evidence are not exposed identically.
7. **Exports prevent lock-in.** Customers can move approved data and its evidence index to another system.
8. **Legal responsibility remains with the customer.** Product copy and workflows must reinforce this boundary.
9. **The regulation is a pack, not a fork.** Adding a regulation must not require changing the engine's domain model.

## 4. Market boundary and differentiation

### 4.1 Initial target segment

An organization of roughly 10–200 employees, subject to a specific regulation with a near-term deadline, with:

- a modest number of regulated entities (products, services, sites, or one reporting organization);
- multiple internal owners and/or outside parties holding the source information;
- no dedicated compliance data platform;
- reliance on email, spreadsheets, and shared drives;
- a named operations, product, engineering, quality, or compliance owner;
- willingness to pay for deadline-risk reduction.

### 4.2 Explicitly excluded initial segments

- large enterprises requiring data spaces and large-scale telemetry;
- organizations whose primary need is execution systems (MES, ERP) rather than readiness;
- parties with no market commitment or budget;
- organizations seeking a legal opinion or an accredited-body decision;
- customers demanding production submission to an authority in the pilot.

### 4.3 Existing solution categories

| Category | Strength | Gap the engine addresses |
| --- | --- | --- |
| Single-regulation point tool | Depth on one regulation | No reuse across the customer's other obligations; often weak provenance |
| Enterprise GRC / data space | Deep integration and cross-enterprise exchange | Cost, implementation time, usability for smaller organizations |
| PIM / PLM / QMS | Master data and lifecycle processes | Regulatory applicability snapshots and evidence-to-claim lineage |
| Shared drive / spreadsheet | Familiar and cheap | Assignment, controlled states, conflict detection, access boundaries, auditability |
| Compliance consultant | Interpretation and judgment | Repeatable workflow, institutional memory, reusable structured evidence |

### 4.4 Market hypothesis

Publication and filing infrastructure is becoming easier and more competitive. The underserved layer is the operational preparation of trustworthy data, and that layer looks similar across many regulations. This is a hypothesis to validate.

### 4.5 Defensible differentiation

Not generic OCR or an AI chatbot, but: a versioned control and applicability catalog per regulation; a reusable owner-to-control ownership graph; evidence-location and approval lineage; unit/method conflict detection; vendor-neutral export mappings; accumulated resolution patterns for real documents; and a growing library of packs that compounds the platform's value with each regulation added.

## 5. Personas and stakeholders

### 5.1 Primary personas

**Responsible Organization Administrator (`ORG_ADMIN`)** — owns the workspace and commercial relationship; confirms the responsible legal entity and scope; controls users, retention, exports, and external sharing; needs portfolio visibility and a defensible record of decisions.

**Compliance or Operations Manager (`COMPLIANCE_MANAGER`)** — runs the readiness project; creates regulated entities, assigns controls, contacts outside parties, resolves missing items; needs status, deadlines, reminders, structured exports.

**Technical Approver (`TECHNICAL_APPROVER`)** — understands the subject matter (engineering, tests, specifications, security, or quality records); reviews extracted values, methods, units, entity relevance, and conflicts; needs exact source location and a clear approve/reject action.

**External Contributor (`SUPPLIER_CONTRIBUTOR`)** — an outside party (supplier, vendor, agency, processor, partner) that receives a narrowly scoped request and supplies values, explanations, and documents without joining the workspace; needs confidentiality, saved progress, precise questions, and a submission receipt.

**Read-only Reviewer (`REVIEWER`)** — an internal executive, consultant, auditor, filing partner, or downstream consumer that reviews a deliberately shared snapshot without editing source data; needs evidence lineage, unresolved items, and export metadata.

### 5.2 Internal platform persona

**Platform Support Operator (`PLATFORM_SUPPORT`)** — supports tenants only through audited, time-bound access; cannot silently edit customer decisions or retrieve encryption secrets; needs diagnostic metadata, job status, and redacted logs.

### 5.3 Stakeholder needs

| Stakeholder | Primary need |
| --- | --- |
| Founder / general manager | Deadline and portfolio risk visibility |
| Product / engineering | Correct fields, units, methods, and entity applicability |
| Procurement | Clear outside-party requests and escalation history |
| Compliance / legal adviser | Traceability and source snapshot, without unsupported certification claims |
| Vendor / partner account manager | Minimal-effort, scoped response flow |
| Downstream consumer (publisher, auditor, integrator) | Structured, portable, approved input plus exceptions |
| Authority / accredited body | Outside MVP interaction; customer-controlled evidence may be exported for review |

## 6. Jobs to be done

- **JTBD-1 Determine preparation scope.** Record the responsible organization, the regulation and control snapshot, the regulated entity and its boundary, the target date, and the entity classification.
- **JTBD-2 Establish ownership.** Assign every control to an internal team, an outside party, or an evidence source so missing ownership is visible.
- **JTBD-3 Request information.** Send one clear, scoped request an outside party can complete without learning the regulation or creating an account.
- **JTBD-4 Convert documents into reviewable proposals.** Locate candidate values and evidence passages while keeping a human approval gate.
- **JTBD-5 Resolve contradictions.** Preserve competing values, surface the conflict, document the resolution.
- **JTBD-6 Measure readiness honestly.** Produce a dated snapshot separating evidenced items from missing, conflicting, stale, pending, conditional, and not-yet-required items.
- **JTBD-7 Hand data to the next system.** Produce a structured export with control IDs, approved values, units, source references, restrictions, and unresolved exceptions.
- **JTBD-8 Respond to regulatory change.** Show which controls and entities are affected by new guidance before choosing whether to migrate or re-review.

## 7. Goals and non-goals

### 7.1 Business goals

- Reduce manual time locating and chasing regulatory evidence.
- Increase the share of required controls with approved, source-linked evidence.
- Shorten outside-party response and internal review cycles.
- Make unresolved risk visible early enough to act before a deadline.
- Build a reusable system of record that survives personnel and vendor changes.
- Create a paid workflow that begins as a service and can become self-serve SaaS, sold per regulation.

### 7.2 Product goals

- Represent each supported regulation as a control pack, limiting self-serve entity creation to pack workflows that have passed validation.
- Preserve the distinction among legal source, guidance interpretation, applicability, value, evidence, and approval.
- Make outside-party contribution possible on phone or desktop without an account.
- Produce a complete export and audit history without requiring a proprietary host.
- Allow control-catalog updates without corrupting historical snapshots.

### 7.3 Non-goals

- Acting as legal counsel, conformity assessor, accredited body, or regulator.
- Guaranteeing acceptance by any registry, authority, or downstream consumer.
- Calculating engineering or sustainability metrics (carbon footprint, recycled content, state of health, embedded emissions).
- Automatically validating the scientific correctness of tests or third-party statements.
- Replacing PLM, ERP, QMS, laboratory, or full supplier-management systems.
- Publishing public records or operating a resolver in MVP.
- Real-time transactional compliance (e-invoicing, tax filing, sanctions/AML transaction screening).
- Direct production submission to an authority in MVP.

## 8. Scope by phase

### 8.1 Concierge pilot (`PILOT`)

One workspace and a small number of regulated entities per customer; operator-led classification and scope questionnaire; one versioned control snapshot for the active pack; manual contact import; request links and document upload (authenticated inbound email only when its feasibility/security gate passes); assisted extraction with human confirmation; readiness matrix and evidence index; CSV, JSON, and accessible HTML export (PDF a separate accessibility `GATE`); manual onboarding and a weekly review call.

### 8.2 Self-serve MVP (`MVP`)

Multi-tenant workspace and role management; portfolio and entity dashboards; automated reminders and request lifecycle; secure document library and extraction jobs; structured claim review, conflict resolution, and approvals; immutable readiness snapshots and comparison; complete audit log and customer data export/deletion; configurable export profiles; subscription and usage administration. One fully validated pack at MVP (EAA accessibility).

### 8.3 Expansion (`LATER`)

Additional control packs; direct integrations with selected downstream consumers; authority test/production integration after independent review; public/restricted hosting and resolver support where a pack needs it; lifecycle/telemetry ingestion where a pack needs it; reusable contributor profiles with consent; browser extension for authenticated third-party portals; mobile capture; consultancy multi-client workspace.

## 9. Business requirements

| ID | Requirement | Phase | Priority |
| --- | --- | --- | --- |
| BR-001 | The product MUST let a customer record the responsible organization, the regulated entity, its classification, its boundary, the target date, and pack-relevant scope facts. | PILOT | Must |
| BR-002 | The product MUST provide an applicability result tied to a named, dated control snapshot and MUST label it as operational guidance, not legal advice. | PILOT | Must |
| BR-003 | The product MUST preserve immutable historical control snapshots and show the impact of a newer snapshot before migration. | MVP | Must |
| BR-004 | The product MUST support tenant-scoped roles for administrator, manager, technical approver, reviewer, and external contributor. | MVP | Must |
| BR-005 | The product MUST let a customer assign each control to one or more internal owners, outside parties, or evidence sources. | PILOT | Must |
| BR-006 | The product MUST create a request containing only authorized fields and contextual instructions for the affected entity. | PILOT | Must |
| BR-007 | An external contributor MUST be able to save and submit a response through a scoped, expiring link without creating a workspace account. | PILOT | Must |
| BR-008 | The product MUST accept common documents and structured files, preserve originals, and associate them with organization, contributor, entity, request, and access classification. | PILOT | Must |
| BR-009 | Automated extraction MUST create review proposals with exact document and location references; it MUST NOT approve a value. | PILOT | Must |
| BR-010 | Authorized humans MUST be able to approve, reject, edit, supersede, or request clarification for a proposed claim. | PILOT | Must |
| BR-011 | Every approved claim MUST retain its value, unit, method/context, evidence links, reviewer, timestamp, and control-snapshot relationship. | PILOT | Must |
| BR-012 | The product MUST detect and display competing active claims for the same control and MUST require documented resolution before an evidenced-ready state. | MVP | Must |
| BR-013 | The product MUST use explicit readiness states: `EVIDENCED`, `MISSING`, `CONFLICTING`, `STALE`, `PENDING_REVIEW`, `CONDITIONAL`, `NOT_YET_REQUIRED`, `NOT_APPLICABLE`. | PILOT | Must |
| BR-014 | Portfolio and entity summaries MUST expose counts and blockers by state; they MUST NOT collapse unresolved states into a single compliance percentage. | PILOT | Must |
| BR-015 | The product MUST send configurable reminders, record delivery, and prevent harassment through rate limits and quiet periods. | MVP | Should |
| BR-016 | The product MUST export approved data, source indexes, restrictions, unresolved exceptions, and snapshot metadata in portable formats. | PILOT | Must |
| BR-017 | Exports MUST clearly distinguish customer-approved claims, contributor assertions, and unreviewed extraction proposals. | PILOT | Must |
| BR-018 | The product MUST provide a complete, user-visible audit trail for security-sensitive and evidence-changing actions. | MVP | Must |
| BR-019 | Customers MUST control external reviewer access, expiration, download permission, and revocation. | MVP | Must |
| BR-020 | Documents and controls MUST support access classifications aligned to public, restricted/legitimate-interest, authority-oriented, and internal-only handling. | MVP | Must |
| BR-021 | The product MUST provide customer-controlled retention, legal-hold labeling, export, and deletion workflows, subject to documented operational constraints. | MVP | Must |
| BR-022 | The contributor and operator web experiences MUST meet WCAG 2.2 AA design intent and remain usable on phone, tablet, laptop, and desktop browsers. | MVP | Must |
| BR-023 | Regulatory or product copy MUST include source date and limitations and MUST NOT promise certification, official approval, or legal completeness. | PILOT | Must |
| BR-024 | The product SHOULD support reusable export mappings without making one downstream vendor the canonical internal schema. | MVP | Should |
| BR-025 | Platform support access MUST be explicit, time-bound, customer-visible, and audited. | MVP | Must |
| BR-026 | The service MUST provide incident communication and a documented path to revoke compromised contributor/reviewer links. | MVP | Must |
| BR-027 | Commercial plans MUST NOT charge external contributors to respond to customer requests. | MVP | Must |
| BR-028 | The product SHOULD support a consultancy workspace that separates client tenants and branding without permitting cross-client data access. | LATER | Could |
| BR-029 | The product MUST support multiple control packs in one deployment, and a customer MUST be able to run more than one regulation without data bleeding between packs. | MVP | Must |

## 10. Readiness and claims policy

### 10.1 Readiness states

| State | Meaning | May count as ready for the selected snapshot? |
| --- | --- | --- |
| `EVIDENCED` | An authorized reviewer approved a claim with at least one acceptable current source | Yes, for evidence preparation only |
| `MISSING` | No active claim or acceptable evidence exists | No |
| `CONFLICTING` | Two or more unresolved claims disagree materially | No |
| `STALE` | Evidence or approval is outside a configured validity condition | No |
| `PENDING_REVIEW` | A contributor response or extraction proposal awaits authorized review | No |
| `CONDITIONAL` | Applicability or required content depends on a fact not yet established | No |
| `NOT_YET_REQUIRED` | The selected source says the item is not to be filled/displayed as of the target snapshot date | Excluded, with explanation |
| `NOT_APPLICABLE` | The item does not apply to the entity classification or entity facts | Excluded, with rationale |

`EVIDENCED` means only that the customer's preparation record contains approved source-linked information. It does not mean the value is legally correct, scientifically validated, accepted by an authority, or successfully published.

### 10.2 Overall entity status

Derived deterministically:

- `BLOCKED` if any required control is `MISSING`, `CONFLICTING`, `STALE`, or `CONDITIONAL`.
- `REVIEW_NEEDED` if no blocker exists but one or more required controls are `PENDING_REVIEW`.
- `EVIDENCE_READY` if every control required by the selected snapshot is `EVIDENCED` and excluded controls have recorded applicability reasons.
- `OUTDATED_SNAPSHOT` if a newer control snapshot exists and the customer has not completed impact review.

The interface MAY show a completion ratio by state but MUST display the state distribution and MUST NOT label the ratio "compliance."

### 10.3 Source hierarchy

The software displays sources; it does not create a legal hierarchy. Operationally, the control team SHOULD prioritize: (1) the regulation and published delegated/implementing acts; (2) official registry documentation and harmonized-standard references; (3) dated authority guidance, with its disclaimer preserved; (4) customer legal/technical interpretations, explicitly attributed; (5) downstream-consumer schema mappings, treated as integration requirements rather than law.

## 11. Customer experience requirements

### 11.1 Onboarding

- A new manager SHOULD reach a first entity readiness matrix within 20 minutes using assisted onboarding.
- The system MUST ask whether the user is the responsible organization or is preparing data for one, and MUST NOT infer legal responsibility from a company address or role.
- The user MUST acknowledge the product limitation before producing the first snapshot or export.

### 11.2 External contributor experience

- A request link MUST identify the requesting organization, the affected entity, the due date, the requested subjects, a confidentiality notice, and a support contact.
- The contributor MUST be able to decline, flag the wrong recipient, request clarification, or state that information is unavailable.
- Each requested field MUST explain expected form, unit, and evidence type when known.
- A contributor MUST receive a receipt without gaining access to unrelated entity information.

### 11.3 Review experience

- Reviewers MUST see the proposed value and source passage together and be able to compare an incoming value with the current approved value.
- Edits MUST create a new claim revision; they MUST NOT modify the original extraction or contributor assertion.
- Rejection and supersession MUST require a reason.

### 11.4 Export experience

- The export flow MUST require a named snapshot, included access classes, and unresolved-item acknowledgment.
- A generated package MUST include a manifest, schema/version, time, actor, included entities, control snapshot, and hashes for included source files or redacted derivatives.
- The product MUST warn when an export includes confidential or restricted evidence.

## 12. Commercial model hypotheses

### 12.1 Entry offer

**Regulatory Readiness Sprint** — one regulated entity, one regulation, two request rounds, a structured evidence matrix, a missing/conflict report, one export package, and an assisted review call. Directional price hypothesis: EUR 750–1,500 per entity per regulation, excluding specialist legal, laboratory, or metric work.

### 12.2 SaaS hypothesis

After pilot validation, per-tenant subscription scaled by active regulations, entities, reviewers, mappings, and reminder automation. Directional: Starter EUR 99/month, Growth EUR 299/month, Consultancy/enterprise later. External contributors and reviewers never pay and never consume a paid seat. Pricing is a discovery hypothesis.

### 12.3 Expansion revenue

Onboarding and document migration; additional entity readiness sprints; additional control packs; downstream/export integrations; controlled contributor-network features; private deployment or regional data-residency options.

## 13. Success metrics and validation gates

### 13.1 Discovery metrics (per pack)

- ≥15 interviews with in-scope organizations; ≥5 willing to demonstrate their current workflow; ≥3 willing to share a redacted real document set under agreement; ≥3 paid pilots from independent organizations; ≥2 customers willing to continue after the sprint.

### 13.2 Pilot outcome metrics

- Median time to establish the initial entity/control matrix: under 2 hours with assistance.
- ≥30% reduction in time spent on outside-party follow-up versus the customer's stated baseline.
- ≥80% of accepted values have a precise source location and reviewer attribution.
- <2% of approved values require correction because the system associated evidence with the wrong entity or field; any silent cross-entity association is a severity-one defect.
- 100% of unresolved required items remain visible in the final package.
- ≥70% contributor-link completion without live training.

### 13.3 MVP product metrics

- Time to first request under 30 minutes for a prepared user.
- Median contributor form completion under 20 minutes, excluding document gathering.
- Extraction proposal precision sufficient to save reviewer time; target established per field family during the pilot.
- Zero unauthorized cross-tenant document access.
- Export generation success above 99% for supported profiles.
- Customer-visible audit coverage for 100% of defined auditable actions.

### 13.4 Stop/redirect criteria

Do not build a broad self-serve platform if any two are true after the pilot: fewer than three organizations will pay for the readiness sprint; customers refuse to place documents in a third-party system even with appropriate controls; existing vendors already solve the full evidence workflow at acceptable cost and portability; contributor participation requires repeated synchronous training; the average customer has too few entities or too little recurring change to support retention; the required legal/engineering interpretation makes a software-led result unsafe without embedded professional services; export formats remain too unstable for a credible supported contract.

## 14. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Guidance or implementing acts change | Wrong applicability or rework | Immutable snapshots, change impact, primary-source review, no silent migration |
| Product implies legal approval | Customer harm and liability | Claims policy, UX disclaimers, staff review, prohibited-language tests |
| Confidential data leaks | Severe commercial and regulatory harm | Classification, least privilege, encryption, scoped links, audit, redaction |
| AI invents or misreads values | Unsupported claims | Source-bound proposals, confidence, human approval, field-specific validators |
| Contributor sends data for the wrong entity | Cross-entity contamination | Entity confirmation, request scoping, association review, visible lineage |
| Contributor fatigue | Low completion | Short requests, saved progress, grouped fields, clear reason, reminder limits |
| A vendor adds a comparable workflow | Reduced differentiation | Vendor-neutral evidence layer, export portability, deeper provenance, multi-pack breadth |
| Small customers have low willingness to pay | Weak economics | Paid pilot before build, segment by deadline exposure and entity count |
| Authority integration changes | Failed promises | Defer production integration; validate test environment and official docs first |
| Customers expect metric calculation | Scope expansion | Explicit non-goals; partner/referral model for labs, LCA, and specialists |
| A weak first pack poisons the platform's credibility | Slow adoption | Two-person source review gate; honest readiness states; concierge-first per pack |

## 15. Delivery assumptions

### 15.1 Team

Directional MVP team: one product/full-stack engineer; one part-time product designer/researcher; one domain adviser for the active pack; one security/privacy reviewer before customer document ingestion; customer-success involvement during every pilot.

### 15.2 Directional schedule

| Phase | Duration | Output |
| --- | --- | --- |
| Discovery and paid-pilot sales (per pack) | 2–3 weeks | Interview evidence, sample documents, three signed pilots |
| Concierge workflow | 3–5 weeks | Manual control matrix, secure uploads, request links, export package |
| Technical feasibility spikes | 2–3 weeks, partly parallel | Extraction, email intake, tenancy, audit, export prototypes |
| Narrow self-serve MVP (pack #1) | 10–16 weeks with 2–3 people | One validated production workflow |
| Broader commercial hardening | 3–6 additional months | More packs, integrations, reliability, security maturity |

Planning ranges, not delivery commitments. The MVP scope has historically been underestimated for a small team; treat these as optimistic.

## 16. Phased delivery

- **Phase 0 — Evidence discovery.** Recruit in-scope organizations for the active pack; collect redacted examples; map actual request and approval steps; confirm who signs and who pays; test price with a paid service offer.
- **Phase 1 — Concierge pilot.** Use the canonical control catalog and evidence model; deliver real requests and readiness packages; record time, response, confusion, extraction quality, and corrections; label assisted steps.
- **Phase 2 — Self-serve MVP (pack #1).** Production tenancy and permissions; operator and contributor web flows; extraction proposals and review; readiness snapshots and portable exports; billing and basic support.
- **Phase 3 — Pack and integration expansion.** Additional packs; selected downstream mappings; authority test integration spike; reusable contributor profiles with consent.
- **Phase 4 — Lifecycle data (only where a pack needs it).** Individual instances; service events and controlled updates; public/restricted experiences. Only after identity, access, integrity, availability, and integration gates pass.

## 17. MVP business acceptance criteria

The MVP is business-acceptable only when:

1. An `ORG_ADMIN` can create a workspace, invite a manager and approver, and revoke access.
2. A manager can create a regulated entity for the validated pack and obtain a matrix from a named control snapshot.
3. A manager can assign missing controls and send a scoped request.
4. An external contributor can complete, save, and submit a request on phone and desktop without an account.
5. Original documents remain unchanged and retrievable by authorized users.
6. Extraction proposals show exact sources and never self-approve.
7. An approver can accept, reject, supersede, or request clarification with history preserved.
8. Conflicting active claims block `EVIDENCE_READY`.
9. A readiness snapshot cannot hide missing or unresolved required items.
10. An export distinguishes approved claims, contributor assertions, and unreviewed proposals.
11. Access-class and external-sharing restrictions are enforced and tested.
12. Every defined evidence-changing action appears in an immutable customer-visible audit history.
13. Customer export and deletion workflows complete as documented.
14. Product language contains no certification or legal-guarantee claim.
15. Two or more packs can coexist in one deployment with no cross-pack or cross-tenant data bleed.
16. At least three independent paid pilots meet the agreed acceptance criteria before the product is called validated.

## 18. Open business decisions

| Decision | Owner | Needed by |
| --- | --- | --- |
| First pack and its target jurisdiction/language | Product owner | Before paid pilot contracts |
| Whether the first customer is the responsible organization or a consultancy | Product owner | Before pricing test |
| Evidence retention default and customer contract | Legal/privacy adviser | Before customer uploads |
| Acceptable contributor authentication for high-sensitivity evidence | Security and domain adviser | Before MVP |
| Whether reviewers can download restricted source files | Product/security | Before reviewer portal |
| Initial downstream export profiles per pack | Design partners | During pilot |
| Human-review service boundary and staffing | Product owner | Before commercial launch |
| Supported document languages | Product/domain adviser | Before extraction contract |
| Pricing unit: per regulation, per entity, per seat, per evidence volume, or blend | Product owner | Before paid pilots |
