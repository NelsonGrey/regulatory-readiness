# Passport Inbox — Business Requirements

**Document type:** Business Requirements Document (BRD)  
**Version:** 0.1  
**Status:** Proposed / discovery  
**Last updated:** August 30, 2026  
**Owner:** Mark Nelson  
**Working product name:** Passport Inbox (placeholder)

Related documents: [Technical Requirements](TECHNICAL_REQUIREMENTS.md) and [Detailed Design](detailed-design/README.md)

> Passport Inbox is a prospective product independent of the user's existing applications. It prepares evidence and data for external battery-passport workflows; it does not provide legal advice, conformity assessment, certification, or guaranteed compliance.

---

## 1. Executive Summary

From 18 February 2027, each electric-vehicle battery, each light-means-of-transport battery, and each industrial battery over 2 kWh placed on the EU market or put into service must have a battery passport. The responsible economic operator must maintain the finished battery's passport even when much of the source information originates with cell, module, pack, test, and manufacturing suppliers.

Passport-generation products can host records, create QR codes, and register identifiers. They do not remove the operational burden of finding source documents, requesting missing information, reconciling contradictions, deciding which version is current, and proving where each value came from.

Passport Inbox addresses that upstream evidence gap. It gives smaller battery-product companies a structured workspace to:

- determine the relevant battery category and control snapshot;
- assign every required or potentially required data point to an internal owner or supplier;
- request information through a simple no-account supplier experience;
- extract proposed values from documents without treating AI output as fact;
- connect approved claims to exact evidence locations;
- expose missing, conflicting, stale, and not-yet-required information;
- produce a traceable package for a selected passport publisher, consultant, auditor, or internal system.

The recommended entry market is LMT batteries used in e-bikes, e-mopeds, and e-scooters. The commercial entry is a paid, concierge-assisted readiness sprint rather than an unvalidated self-serve subscription.

## 2. Problem Statement

### 2.1 Customer problem

Smaller brands, importers, assemblers, and manufacturers often receive battery information through:

- supplier PDFs and test reports;
- spreadsheets using inconsistent field names and units;
- declarations attached to email threads;
- product data split across engineering, procurement, operations, and legal staff;
- supplier portals that cannot be exported cleanly;
- documents with no explicit link to the affected model, batch, or validity period.

The responsible operator therefore cannot answer basic readiness questions confidently:

- Which battery categories and data points apply?
- Who owns each answer?
- Is a value a supplier assertion, an internal calculation, or a test result?
- Which document and page support it?
- Are two suppliers describing the same metric using compatible units and methods?
- Is evidence current for the model intended for the EU market?
- Which items are legally due in February 2027, later, conditional, optional, duplicated, or unresolved?
- Can the data be transferred to a passport publisher without repeating the entire collection exercise?

### 2.2 Business consequences

Unstructured preparation can result in:

- inability to place an affected battery on the EU market on schedule;
- delayed product launches or inventory holds;
- expensive emergency consulting and supplier escalation;
- unsupported or contradictory passport claims;
- rework when guidance or technical schemas change;
- dependence on one employee, consultant, or passport vendor;
- exposure of confidential composition and test information to the wrong party;
- weak evidence when an authority, notified body, repairer, customer, or downstream partner asks for support.

### 2.3 Opportunity statement

Create a vendor-neutral evidence-readiness system that coordinates suppliers and internal teams before data enters a public or regulated passport infrastructure.

## 3. Product Vision and Positioning

### 3.1 Vision

Every battery-passport value should have an identifiable owner, an applicability basis, a current source, an approval history, and an honest readiness state.

### 3.2 Positioning statement

For smaller battery-product companies that must prepare EU battery-passport information, Passport Inbox collects supplier evidence, maps it to versioned data requirements, and produces a reviewable export. Unlike QR/passport generators or generic document repositories, it makes missing information, contradictions, provenance, and source changes explicit before publication.

### 3.3 Category

Preferred category: **battery-passport evidence readiness**.

Adjacent categories include:

- supplier data collection;
- product compliance operations;
- product information management;
- digital product passport infrastructure;
- document intelligence;
- supply-chain traceability.

### 3.4 Product principles

1. **Evidence is not the same as a claim.** Store both and preserve the relationship.
2. **Extraction is not verification.** AI and OCR create proposals; authorized humans accept or reject them.
3. **Applicability is versioned.** A data point's status depends on battery category, effective date, and source snapshot.
4. **Uncertainty remains visible.** Missing, conflicting, stale, and review-pending states never become green by averaging.
5. **Suppliers should not need training or another account.** A scoped request link should be sufficient.
6. **Confidentiality follows the data point and evidence.** Public-passport data and restricted technical evidence are not exposed identically.
7. **Exports prevent lock-in.** Customers can move approved data and its evidence index to another system.
8. **Legal responsibility remains with the economic operator.** Product copy and workflows must reinforce this boundary.

## 4. Market Boundary and Differentiation

### 4.1 Initial target segment

The first segment is an EU-facing organization with approximately 10–200 employees that places LMT battery products on the market and has:

- 1–50 active battery models;
- multiple cell, pack, test, or manufacturing suppliers;
- no dedicated product-compliance data platform;
- meaningful reliance on email, spreadsheets, and shared drives;
- a named operations, product, engineering, quality, or compliance owner;
- willingness to pay for deadline risk reduction.

Illustrative customers:

- e-bike brands using private-label battery packs;
- e-scooter or e-moped manufacturers and importers;
- LMT battery assemblers serving several brands;
- small home-storage brands that may later use the industrial-battery workflow;
- compliance consultancies supporting multiple smaller operators.

### 4.2 Explicitly excluded initial segments

- global automotive OEMs requiring enterprise data spaces and large-scale telemetry;
- cell manufacturers whose primary need is manufacturing execution rather than passport readiness;
- hobby sellers with no EU market commitment or budget;
- organizations seeking a legal opinion or notified-body decision;
- customers demanding production DPP Registry submission in the pilot.

### 4.3 Existing solution categories

| Category | Strength | Gap addressed by Passport Inbox |
| --- | --- | --- |
| DPP/passport publisher | Identifier, QR, hosting, public/restricted views, registry connection | Upstream supplier chasing, source-level evidence review, vendor-neutral export |
| Enterprise traceability/data space | Deep integrations and cross-enterprise exchange | Cost, implementation time, and usability for smaller operators |
| PIM/PLM | Product master data and lifecycle processes | Regulatory applicability snapshots and evidence-to-claim lineage |
| Shared drive/spreadsheet | Familiar and inexpensive | Assignment, controlled states, conflict detection, access boundaries, auditability |
| Compliance consultant | Interpretation and human judgment | Repeatable workflow, institutional memory, and reusable structured evidence |

### 4.4 Market hypothesis

Passport publication is becoming easier and more competitive. The underserved layer is the operational preparation of trustworthy data. This is a hypothesis to validate, not a claim that existing vendors lack supplier modules.

### 4.5 Defensible differentiation

The prospective moat is not generic OCR or an AI chatbot. It is:

- a versioned control and applicability catalog;
- a reusable supplier-to-data-point ownership graph;
- evidence-location and approval lineage;
- unit/method conflict detection specific to battery data;
- vendor-neutral export mappings;
- accumulated resolution patterns for real supplier documents;
- a growing, permissioned history of which evidence types successfully satisfy customer review workflows.

## 5. Personas and Stakeholders

### 5.1 Primary personas

#### Economic Operator Administrator (`EO_ADMIN`)

- Owns the workspace and commercial relationship.
- Confirms the responsible organization and product scope.
- Controls users, retention, exports, and external sharing.
- Needs portfolio visibility and a defensible record of decisions.

#### Compliance or Operations Manager (`COMPLIANCE_MANAGER`)

- Runs the readiness project.
- Creates battery models, assigns controls, contacts suppliers, and resolves missing items.
- Needs status, deadlines, reminders, and structured exports.

#### Technical Approver (`TECHNICAL_APPROVER`)

- Understands battery engineering, tests, specifications, or quality records.
- Reviews extracted values, methods, units, model relevance, and conflicts.
- Needs exact source location and a clear approval/rejection action.

#### Supplier Contributor (`SUPPLIER_CONTRIBUTOR`)

- Receives a narrowly scoped request.
- Supplies values, explanations, and documents without joining the operator workspace.
- Needs confidentiality, progress saving, precise questions, and a submission receipt.

#### Read-only Reviewer (`REVIEWER`)

- May be an internal executive, consultant, auditor, publisher, or downstream partner.
- Reviews a deliberately shared snapshot without editing source data.
- Needs evidence lineage, unresolved items, and export metadata.

### 5.2 Internal platform persona

#### Platform Support Operator (`PLATFORM_SUPPORT`)

- Supports tenants only through audited, time-bound access.
- Cannot silently edit customer decisions or retrieve encryption secrets.
- Needs diagnostic metadata, job status, and redacted logs.

### 5.3 Stakeholder needs

| Stakeholder | Primary need |
| --- | --- |
| Founder/general manager | Deadline and portfolio risk visibility |
| Product/engineering | Correct fields, units, methods, and model applicability |
| Procurement | Clear supplier requests and escalation history |
| Compliance/legal adviser | Traceability and source snapshot, without unsupported certification claims |
| Supplier account manager | Minimal-effort, scoped response flow |
| Passport publisher/integrator | Structured, portable, approved input plus exceptions |
| Authority/notified body | Outside MVP interaction; customer-controlled evidence may be exported for review |

## 6. Jobs to Be Done and Use Cases

### JTBD-1: Determine preparation scope

When an operator selects a battery product for EU sale, it wants to record the responsible organization, battery category, model boundary, target date, and applicable control snapshot.

### JTBD-2: Establish ownership

When readiness work begins, the operator wants every data point assigned to an internal team, supplier, or evidence source so missing ownership is visible.

### JTBD-3: Request supplier information

When data is missing, the operator wants to send one clear, scoped request that the supplier can complete without learning the regulation or creating an account.

### JTBD-4: Convert documents into reviewable proposals

When specifications and reports arrive, the operator wants the system to locate candidate values and evidence passages while keeping a human approval gate.

### JTBD-5: Resolve contradictions

When two documents or people supply different values, the operator wants both preserved, the conflict surfaced, and the resolution documented.

### JTBD-6: Measure readiness honestly

When management asks whether a model is ready, the team wants a dated snapshot that separates evidenced items from missing, conflicting, stale, pending, conditional, and not-yet-required items.

### JTBD-7: Hand data to the next system

When a publisher, consultant, or internal integration needs the data, the operator wants a structured export with field IDs, approved values, units, source references, restrictions, and unresolved exceptions.

### JTBD-8: Respond to regulatory change

When official guidance changes, the operator wants to see which controls and battery models are affected before choosing whether to migrate or rerun review.

## 7. Goals and Non-Goals

### 7.1 Business goals

- Reduce manual time spent locating and chasing battery-passport evidence.
- Increase the percentage of required data points with approved, source-linked evidence.
- Shorten supplier response and internal review cycles.
- Make unresolved risk visible early enough to act before the February 2027 deadline.
- Build a reusable system of record that survives personnel and vendor changes.
- Create a paid workflow that begins as a service and can become self-serve SaaS.

### 7.2 Product goals

- Represent the three regulated categories in the control catalog, while limiting self-serve model creation to category workflows that have passed validation; LMT is first.
- Preserve the distinction among legal source, guidance interpretation, applicability, value, evidence, and approval.
- Make supplier contribution possible on phone or desktop without an account.
- Produce a complete export and audit history without requiring a proprietary passport host.
- Allow control updates without corrupting historical snapshots.

### 7.3 Non-goals

- Acting as legal counsel, conformity assessor, notified body, or regulator.
- Guaranteeing acceptance by the DPP Registry, an authority, or a passport publisher.
- Calculating carbon footprint, recycled content, state of health, or other engineering metrics.
- Validating the scientific correctness of tests or supplier statements automatically.
- Replacing PLM, ERP, QMS, laboratory, BMS, or full supplier-management systems.
- Publishing public passports or operating a resolver in MVP.
- Collecting live battery telemetry in MVP.
- Supporting every future ESPR product category before the battery workflow is validated.

## 8. Scope by Phase

### 8.1 Concierge pilot (`PILOT`)

- One workspace and up to three battery models per customer.
- Operator-led category and scope questionnaire.
- Versioned 71-point August 2026 control snapshot.
- Manual supplier/contact import.
- Request links and document upload; authenticated email intake only when its feasibility/security gate passes.
- Assisted extraction with human confirmation.
- Readiness matrix and evidence index.
- CSV, JSON, and accessible HTML summary export; PDF remains a separate accessibility `GATE`.
- Manual onboarding and weekly review call.

### 8.2 Self-serve MVP (`MVP`)

- Multi-tenant workspace and role management.
- Portfolio and model dashboards.
- Automated reminders and supplier request lifecycle.
- Secure document library and extraction jobs.
- Structured claim review, conflict resolution, and approvals.
- Immutable readiness snapshots and comparison.
- Complete audit log and customer data export/deletion.
- Configurable export profiles.
- Subscription and usage administration.

### 8.3 Expansion (`LATER`)

- Direct integrations with selected passport publishers.
- DPP Registry test and production integration after independent review and proven API behavior.
- Public/restricted passport hosting and GS1 Digital Link resolver support.
- BMS and lifecycle data ingestion.
- Supplier reusable profiles and controlled cross-customer sharing.
- Browser extension for authenticated supplier portals.
- Mobile scanning and offline capture.
- Textile, electronics, furniture, and other product categories.

## 9. Business Requirements

| ID | Requirement | Phase | Priority |
| --- | --- | --- | --- |
| BR-001 | The product MUST let an operator record responsible organization, product, battery category, model boundary, target market date, and capacity where relevant. | PILOT | Must |
| BR-002 | The product MUST provide an applicability result tied to a named, dated control snapshot and MUST label it as operational guidance rather than legal advice. | PILOT | Must |
| BR-003 | The product MUST preserve immutable historical control snapshots and show the impact of a newer snapshot before migration. | MVP | Must |
| BR-004 | The product MUST support tenant-scoped roles for administrator, manager, technical approver, reviewer, and supplier contributor. | MVP | Must |
| BR-005 | The product MUST let an operator assign each data point to one or more internal owners, suppliers, or evidence sources. | PILOT | Must |
| BR-006 | The product MUST create a supplier request containing only authorized fields and contextual instructions for the affected model. | PILOT | Must |
| BR-007 | A supplier MUST be able to save and submit a response through a scoped, expiring link without creating a workspace account. | PILOT | Must |
| BR-008 | The product MUST accept common documents and structured files, preserve originals, and associate them with organization, supplier, model, request, and access classification. | PILOT | Must |
| BR-009 | Automated extraction MUST create review proposals with exact document and location references; it MUST NOT approve a value. | PILOT | Must |
| BR-010 | Authorized humans MUST be able to approve, reject, edit, supersede, or request clarification for a proposed claim. | PILOT | Must |
| BR-011 | Every approved claim MUST retain its value, unit, method/context when applicable, evidence links, reviewer, timestamp, and control-snapshot relationship. | PILOT | Must |
| BR-012 | The product MUST detect and display competing active claims for the same data point and MUST require documented resolution before an evidenced-ready state. | MVP | Must |
| BR-013 | The product MUST use explicit readiness states: `EVIDENCED`, `MISSING`, `CONFLICTING`, `STALE`, `PENDING_REVIEW`, `CONDITIONAL`, `NOT_YET_REQUIRED`, and `NOT_APPLICABLE`. | PILOT | Must |
| BR-014 | Portfolio and model summaries MUST expose counts and blockers by state; they MUST NOT collapse unresolved states into a single compliance percentage. | PILOT | Must |
| BR-015 | The product MUST send configurable reminders, record delivery, and prevent harassment through rate limits and quiet periods. | MVP | Should |
| BR-016 | The product MUST export approved data, source indexes, restrictions, unresolved exceptions, and snapshot metadata in portable formats. | PILOT | Must |
| BR-017 | Exports MUST clearly distinguish customer-approved claims, supplier assertions, and unreviewed extraction proposals. | PILOT | Must |
| BR-018 | The product MUST provide a complete, user-visible audit trail for security-sensitive and evidence-changing actions. | MVP | Must |
| BR-019 | Customers MUST control external reviewer access, expiration, download permission, and revocation. | MVP | Must |
| BR-020 | Documents and data points MUST support access classifications aligned to public, restricted/legitimate-interest, authority-oriented, and internal-only handling. | MVP | Must |
| BR-021 | The product MUST provide customer-controlled retention, legal-hold labeling, export, and deletion workflows, subject to documented operational constraints. | MVP | Must |
| BR-022 | The supplier and operator web experiences MUST meet WCAG 2.2 AA design intent and remain usable on phone, tablet, laptop, and desktop browsers. | MVP | Must |
| BR-023 | Regulatory or product copy MUST include source date and limitations and MUST NOT promise certification, official approval, or legal completeness. | PILOT | Must |
| BR-024 | The product SHOULD support reusable export mappings without making one passport vendor the canonical internal schema. | MVP | Should |
| BR-025 | Platform support access MUST be explicit, time-bound, customer-visible, and audited. | MVP | Must |
| BR-026 | The service MUST provide incident communication and a documented path to revoke compromised supplier/reviewer links. | MVP | Must |
| BR-027 | Commercial plans MUST not charge suppliers to respond to customer requests. | MVP | Must |
| BR-028 | The product SHOULD support a consultancy workspace that separates client tenants and branding without permitting cross-client data access. | LATER | Could |

## 10. Readiness and Claims Policy

### 10.1 Readiness states

| State | Meaning | May count as ready for the selected snapshot? |
| --- | --- | --- |
| `EVIDENCED` | An authorized reviewer approved a claim with at least one acceptable current source | Yes, for evidence preparation only |
| `MISSING` | No active claim or acceptable evidence exists | No |
| `CONFLICTING` | Two or more unresolved claims disagree materially | No |
| `STALE` | Evidence or approval is outside a configured validity condition | No |
| `PENDING_REVIEW` | A supplier response or extraction proposal awaits authorized review | No |
| `CONDITIONAL` | Applicability or required content depends on a fact not yet established | No |
| `NOT_YET_REQUIRED` | The selected source says the item is not to be filled/displayed as of the target snapshot date | Excluded, with explanation |
| `NOT_APPLICABLE` | The item does not apply to the selected battery category or model facts | Excluded, with rationale |

`EVIDENCED` means only that the customer's preparation record contains approved source-linked information. It does not mean the value is legally correct, scientifically validated, accepted by an authority, or successfully published.

### 10.2 Overall model status

The model-level status MUST be derived deterministically:

- `BLOCKED` if any required item is `MISSING`, `CONFLICTING`, `STALE`, or `CONDITIONAL`.
- `REVIEW_NEEDED` if no blocker exists but one or more required items are `PENDING_REVIEW`.
- `EVIDENCE_READY` if every item required by the selected snapshot is `EVIDENCED` and excluded items have recorded applicability reasons.
- `OUTDATED_SNAPSHOT` if a newer control snapshot exists and the customer has not completed impact review.

The interface MAY show a completion ratio by state, but MUST display the state distribution and MUST NOT label the ratio “compliance.”

### 10.3 Source hierarchy

The software displays sources; it does not make a legal hierarchy. Operationally, the control team SHOULD prioritize:

1. EU regulations and published delegated/implementing acts.
2. Official EU Registry documentation and harmonized-standard references.
3. Dated European Commission guidance, with its disclaimer preserved.
4. Customer legal/technical interpretations, explicitly attributed.
5. Publisher-specific schema mappings, treated as integration requirements rather than law.

## 11. Customer Experience Requirements

### 11.1 Onboarding

- A new manager SHOULD reach a first model readiness matrix within 20 minutes using assisted onboarding.
- The system MUST ask whether the user is the responsible economic operator or is preparing data for one.
- The system MUST not infer legal responsibility solely from a company address or role.
- The user MUST acknowledge the product limitation before producing the first snapshot or export.

### 11.2 Supplier experience

- A supplier link MUST identify the requesting organization, affected model, due date, requested subjects, confidentiality notice, and support contact.
- The supplier MUST be able to decline, flag the wrong recipient, request clarification, or state that information is unavailable.
- Each requested field MUST explain expected form, unit, and evidence type when known.
- A supplier MUST receive a receipt without receiving access to unrelated model information.

### 11.3 Review experience

- Reviewers MUST see the proposed value and source passage together.
- Reviewers MUST be able to compare an incoming value with the current approved value.
- Edits MUST create a new claim revision; they MUST NOT modify the original extraction or supplier assertion.
- Rejection and supersession MUST require a reason.

### 11.4 Export experience

- The export flow MUST require a named snapshot, included access classes, and unresolved-item acknowledgment.
- A generated package MUST include a manifest, schema/version, time, actor, included models, control snapshot, and hashes for included source files or redacted derivatives.
- The product MUST warn when an export includes confidential or restricted evidence.

## 12. Commercial Model Hypotheses

### 12.1 Entry offer

**Battery Passport Evidence Readiness Sprint**

- One battery model.
- Two supplier request rounds.
- Structured evidence matrix.
- Missing/conflict report.
- One export package.
- Assisted review call.
- Directional price hypothesis: EUR 750–1,500 per model, excluding specialist legal, laboratory, or lifecycle-assessment work.

### 12.2 SaaS hypothesis

After pilot validation:

- Starter: EUR 99/month for a small model portfolio and limited active requests.
- Growth: EUR 299/month for more models, reviewers, mappings, and reminder automation.
- Consultancy/enterprise: later, after tenancy and cross-client administration are proven.

Pricing is a discovery hypothesis, not a commitment.

### 12.3 Expansion revenue

- Onboarding and document migration.
- Additional model readiness sprints.
- Publisher/export integrations.
- Controlled supplier network features.
- Private deployment or regional data-residency options.
- Additional DPP product-category control packs.

## 13. Success Metrics and Validation Gates

### 13.1 Discovery metrics

- At least 15 interviews with in-scope operators.
- At least 5 companies willing to demonstrate their current evidence workflow.
- At least 3 companies willing to share a redacted real document set under agreement.
- At least 3 paid pilots from independent organizations.
- At least 2 customers willing to continue after the sprint.

### 13.2 Pilot outcome metrics

- Median time to establish the initial model/control matrix: under 2 hours with assistance.
- At least 30% reduction in operator time spent on supplier follow-up versus the customer's stated baseline.
- At least 80% of accepted values have a precise source location and reviewer attribution.
- Fewer than 2% of approved values require correction because the system associated evidence with the wrong model or field; any silent cross-model association is a severity-one defect.
- 100% of unresolved required items remain visible in the final package.
- At least 70% supplier-link completion without live training.

### 13.3 MVP product metrics

- Time to first supplier request under 30 minutes for a prepared user.
- Median supplier form completion under 20 minutes, excluding document gathering.
- Extraction proposal precision sufficient to save reviewer time; target to be established per field family during the pilot.
- Zero unauthorized cross-tenant document access.
- Export generation success above 99% for supported profiles.
- Customer-visible audit coverage for 100% of defined auditable actions.

### 13.4 Stop/redirect criteria

Do not build a broad self-serve platform if any two are true after the pilot:

- fewer than three companies will pay for the readiness sprint;
- customers refuse to place documents in a third-party system even with appropriate controls;
- existing passport vendors already solve the full evidence workflow at acceptable cost and portability;
- supplier participation requires repeated synchronous training;
- the average customer has too few models or too little recurring change to support retention;
- the required legal/engineering interpretation makes a software-led result unsafe without embedded professional services;
- export formats remain too unstable for a credible supported contract.

## 14. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Guidance or implementing acts change | Wrong applicability or rework | Immutable snapshots, change impact, primary-source review, no silent migration |
| Product implies legal approval | Customer harm and liability | Claims policy, UX disclaimers, staff review, prohibited-language tests |
| Confidential composition/test data leaks | Severe commercial and regulatory harm | Classification, least privilege, encryption, scoped links, audit, redaction |
| AI invents or misreads values | Unsupported claims | Source-bound proposals, confidence, human approval, field-specific validators |
| Supplier sends data for wrong model | Cross-model contamination | Model confirmation, request scoping, document association review, visible lineage |
| Supplier fatigue | Low completion | Short requests, saved progress, grouped fields, clear reason, reminder limits |
| Passport vendor adds comparable workflow | Reduced differentiation | Vendor-neutral evidence layer, export portability, deeper provenance and services |
| Small customers have low willingness to pay | Weak economics | Paid pilot before build, segment by deadline exposure and model count |
| DPP Registry integration changes | Failed promises | Defer production integration; validate test environment and official docs first |
| Customers expect metric calculation | Scope expansion | Explicit non-goals; partner/referral model for labs, LCA, and engineering specialists |

## 15. Delivery Assumptions

### 15.1 Team

Directional MVP team:

- one product/full-stack engineer;
- one part-time product designer/researcher;
- one battery/compliance domain adviser;
- one security/privacy reviewer before customer document ingestion;
- customer-success involvement during every pilot.

### 15.2 Directional schedule

| Phase | Duration | Output |
| --- | --- | --- |
| Discovery and paid-pilot sales | 2–3 weeks | Interview evidence, sample documents, three signed pilots |
| Concierge workflow | 3–5 weeks | Manual control matrix, secure uploads, request links, export package |
| Technical feasibility spikes | 2–3 weeks, partly parallel | Extraction, email intake, tenancy, audit, export prototypes |
| Narrow self-serve MVP | 10–16 weeks with 2–3 people | LMT-first production workflow |
| Broader commercial hardening | 3–6 additional months | More categories, integrations, reliability, security maturity |

These are planning ranges, not delivery commitments.

## 16. Phased Delivery

### Phase 0 — Evidence discovery

- Recruit in-scope operators.
- Collect redacted examples.
- Map actual supplier and approval steps.
- Confirm who signs and who pays.
- Test price using a paid service offer.

### Phase 1 — Concierge pilot

- Use the canonical control catalog and evidence model.
- Deliver real supplier requests and readiness packages.
- Record time, response, confusion, extraction quality, and corrections.
- Do not expose a fake automated dashboard where staff are doing hidden manual work; label assisted steps.

### Phase 2 — LMT self-serve MVP

- Production tenancy and permissions.
- Operator and supplier web flows.
- Extraction proposals and review.
- Readiness snapshots and portable exports.
- Billing and basic support operations.

### Phase 3 — Category and integration expansion

- Industrial and EV workflow optimization.
- Selected publisher mappings.
- Registry test integration spike.
- Supplier reusable profiles with explicit consent.

### Phase 4 — Lifecycle data

- Individual-battery instances.
- BMS/service events and controlled updates.
- Public/restricted passport experiences.
- Only after identity, access, integrity, availability, and regulatory integration gates pass.

## 17. MVP Business Acceptance Criteria

The MVP is business-acceptable only when:

1. An `EO_ADMIN` can create a workspace, invite a manager and approver, and revoke access.
2. A manager can create an LMT model and obtain a matrix from a named control snapshot.
3. A manager can assign missing fields and send a scoped supplier request.
4. A supplier can complete, save, and submit the request on phone and desktop without an account.
5. Original documents remain unchanged and retrievable by authorized users.
6. Extraction proposals show exact sources and never self-approve.
7. An approver can accept, reject, supersede, or request clarification with history preserved.
8. Conflicting active claims block `EVIDENCE_READY`.
9. A readiness snapshot cannot hide missing or unresolved required items.
10. An export distinguishes approved claims, supplier assertions, and unreviewed proposals.
11. Access-class and external-sharing restrictions are enforced and tested.
12. Every defined evidence-changing action appears in an immutable customer-visible audit history.
13. Customer export and deletion workflows complete as documented.
14. Product language contains no certification or legal-guarantee claim.
15. At least three independent paid pilots meet the agreed acceptance criteria before the product is called validated.

## 18. Open Business Decisions

| Decision | Owner | Needed by |
| --- | --- | --- |
| First country/language and legal-entity focus | Product owner | Before paid pilot contracts |
| Whether the first customer is the economic operator or a consultancy | Product owner | Before pricing test |
| Evidence retention default and customer contract | Legal/privacy adviser | Before customer uploads |
| Acceptable supplier authentication for high-sensitivity evidence | Security and domain adviser | Before MVP |
| Whether reviewers can download restricted source files | Product/security | Before reviewer portal |
| Initial publisher/export profiles | Design partners | During pilot |
| Human-review service boundary and staffing | Product owner | Before commercial launch |
| Supported document languages | Product/domain adviser | Before extraction contract |
| Whether EU-only hosting is a segment requirement | Discovery customers | Before infrastructure selection |

## 19. External References

- [Regulation (EU) 2023/1542](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R1542)
- [Commission battery-passport overview](https://single-market-economy.ec.europa.eu/single-market/digital-product-passport/batteries_en)
- [Commission data-point guidance, version 2.0](https://single-market-economy.ec.europa.eu/document/download/cd1e5e6c-4a4a-4b99-995a-49eb6916187e_en?filename=Digital+Batteries+Passport+-+data+point+by+category.pdf)
- [DPP Registry overview](https://single-market-economy.ec.europa.eu/single-market/digital-product-passport/dpp-registry_en)
- [DPP Registry launch announcement](https://single-market-economy.ec.europa.eu/news/digital-product-passport-registry-now-live-2026-07-20_en)
- [Harmonized DPP standards publication page](https://single-market-economy.ec.europa.eu/single-market/goods/european-standards/harmonised-standards/digital-product-passport-dpp_en)
- [GS1 Digital Link](https://www.gs1.org/standards/gs1-digital-link)
