# Regulatory Readiness Engine — Product Concept

**Document type:** Product Concept / Platform Framing
**Version:** 0.1
**Status:** Proposed / discovery
**Last updated:** August 30, 2026
**Owner:** Mark Nelson
**Working product name:** Regulatory Readiness Engine (placeholder; not trademark-cleared)

Related documents: [engine/README.md](engine/README.md) — vertical-neutral [Business Requirements](engine/BUSINESS_REQUIREMENTS.md), [Technical Requirements](engine/TECHNICAL_REQUIREMENTS.md), and [Detailed Design](engine/detailed-design/README.md). Platform: [AWS Architecture](ARCHITECTURE_AWS.md) and [ADR 0001 — Build on AWS](adr/0001-cloud-platform-aws.md). Regulation specifics: [packs/](packs/).

> This platform prepares and organizes the evidence needed to demonstrate readiness for a specific regulation. It does not provide legal advice, conformity assessment, certification, guaranteed compliance, or submission to any authority.

---

## 1. Summary

The Regulatory Readiness Engine is a multi-tenant platform that helps small and mid-size organizations assemble, validate, version, and export the evidence needed to prepare for a specific regulation — while keeping missing, conflicting, stale, and unreviewed information visible, and without ever claiming legal compliance.

The platform is **one reusable engine** plus a growing library of **control packs**. Each pack encodes one regulation as a dated, versioned catalog of discrete controls, with applicability rules, evidence expectations, field validators, and export profiles. Adding a regulation is adding a pack — mostly data and declared rules, not a code fork.

The battery-passport requirements package was the origin design. It has been split (section 9): a vertical-neutral engine specification now lives in [`engine/`](engine/), and the battery-specific material is preserved as the first control pack in [`packs/espr-dpp-battery/`](packs/espr-dpp-battery/).

## 2. The problem shape the engine addresses

Across many regulations, a responsible organization faces the same operational job, independent of subject matter:

- decompose a regulation into concrete required items;
- decide which items apply given facts about the entity, product, service, or market;
- assign each item to an internal owner or an external party (supplier, partner, processor);
- collect values and documents, often from parties who will not create an account;
- keep original evidence distinct from asserted claims and from approved claims;
- surface what is missing, conflicting, stale, conditional, or not yet required;
- produce a point-in-time, traceable package for an auditor, authority, customer, or downstream filing system;
- re-assess when the regulation or its guidance changes, without rewriting history.

Existing tools are enterprise-priced and integration-heavy, single-regulation point solutions, or generic document stores. The underserved layer is affordable, multi-regulation **evidence readiness with honest provenance** for smaller operators.

## 3. What the engine is not

- not legal advice, conformity assessment, certification, or an authority;
- not an automated legal-decision engine;
- not a filing or publishing endpoint — no direct authority or registry submission in MVP;
- not a calculation engine — no carbon math, recycled-content math, or test validation;
- not a real-time transactional compliance system — e-invoicing, tax filing, and sanctions/AML transaction screening are explicitly out of scope;
- not a replacement for PLM, ERP, QMS, or full supplier-management systems.

## 4. Engine primitives (built once, shared by every pack)

| Primitive | Responsibility | Key invariant |
| --- | --- | --- |
| Control catalog service | Stores dated, versioned regulation decompositions and their source metadata | Snapshots are immutable; a correction is a new snapshot |
| Applicability evaluator | Deterministic, inspectable rules over entity/product/market facts | Unknown facts yield a "conditional" result, never a guess |
| Readiness state machine | Computes a fixed state enum per control and per entity | Pure and replayable for the same versioned inputs |
| Evidence store | Immutable originals, derivatives, exact source locations, provenance | Originals are never mutated; derivatives cite the source hash |
| Assertion & claim model | Origin-tagged assertions, immutable claim revisions, human review gates | No automated process can approve a value |
| Conflict engine | Detects competing active claims for one control | Never auto-resolves; blocks "evidence ready" until resolved |
| External collection portal | Scoped, no-account, expiring token principals for suppliers and reviewers | A token exposes only its own request/disclosure |
| Extraction adapter | AI/OCR proposes source-bound values | A proposal with no source location cannot be accepted |
| Snapshot & export | Immutable point-in-time readiness manifests and portable profiles | Export content is generated only from an immutable snapshot |
| Audit / tenancy / classification / retention / notifications / observability | Cross-cutting platform services | Tenant scope on every row and object; tokens and evidence text never in logs |

Every primitive above is specified in prose in the [engine Technical Requirements](engine/TECHNICAL_REQUIREMENTS.md). The build work is to implement each primitive pack-agnostically, with pack data as the only regulation-specific input.

## 5. Control-pack contract

A pack is data plus a small amount of declared logic. Required artifacts:

| Artifact | Contents |
| --- | --- |
| `manifest.json` | pack key, regulation title, official source URL(s), publication/guidance date, retrieval date, source checksum, catalog version, supersedes/superseded-by, jurisdiction, effective dates |
| `controls.json` | enumerated controls: stable internal key, official identifier/name, source citation, field family, expected value type/unit/method, evidence expectation, access-class default, compiled applicability expression |
| `entity-facts.schema.json` | the facts the applicability evaluator needs (e.g., product category, market region, headcount, turnover band, sector, service type) |
| `applicability/` | deterministic expressions over entity facts plus the selected snapshot |
| `export-profiles/` | canonical JSON always; regulation- or authority-specific profiles optional |
| `validators/` | deterministic field-family validators — type, range, enumeration, date, presence |
| `copy/` | readiness-state labels, limitation language, forbidden-claim list, source disclaimer |
| `test-vectors.json` | known applicability and readiness outcomes, control count, checksum |
| `source-notes.md` | transcription notes, ambiguities, and the two-person review record |

**Governance.** Every production pack requires an independent two-person source review (`GATE`). A corrected pack is a new immutable snapshot even if the source date is unchanged. Automated tests validate control count, unique keys, referential integrity, rule compilation, known category outcomes, and checksum.

## 6. Pack portfolio and sequencing

Regulatory dates and scope below are indicative and MUST be verified from primary sources during each pack's discovery.

### Tier 1 — strongest fit, demand live now

| Pack | Primary buyer | Timing | Status |
| --- | --- | --- | --- |
| EAA accessibility readiness | B2C digital businesses, agencies | Enforcement since June 2025 | **Proposed pack #1** |
| EUDR due diligence | SME importers (coffee, cocoa, timber, soy, palm, rubber, cattle) | SME obligations ~mid-2026 | Candidate |
| ESPR DPP — batteries | LMT/EV/industrial battery operators | February 2027 | Origin design; `docs/` package |
| EU AI Act conformity readiness | Providers/deployers of high-risk AI | High-risk obligations 2026–2027 | Candidate |
| CSRD / VSME reporting | Mid-size companies; small suppliers answering buyer questionnaires | In flux (EU Omnibus simplification) | **Hold** until scope settles |

### Tier 2 — strong fit, adjacent or slightly later

| Pack | Primary buyer |
| --- | --- |
| Cyber Resilience Act (CRA) | Any product with digital elements sold in the EU |
| DORA readiness | Financial entities and their ICT third parties |
| NIS2 readiness | Essential and important entities |
| MDR / IVDR technical documentation | Small medical-device manufacturers |
| REACH / RoHS / SCIP / PPWR | Manufacturers and importers |
| Supply-chain due diligence (CSDDD / LkSG / Norway Transparency Act) | Large-mid companies and their suppliers |
| EU Forced Labour Regulation | Importers and manufacturers |
| CBAM | Importers of steel, aluminium, cement, fertiliser, etc. |
| Future ESPR DPP packs | Textiles/apparel, electronics, furniture, tyres, steel |

### Tier 3 — fits the pattern, different or more generic buyer

SOC 2 / ISO 27001 / ISO 9001 audit readiness; GDPR ROPA / DPIA documentation; grant and public-tender readiness dossiers; food-safety (HACCP / BRCGS) audit prep; US CMMC / FAR-DFARS / FSMA if the platform expands beyond the EU.

### Sequencing

1. **Build the engine against EAA accessibility as pack #1.** Largest live market, enforcement already in force, strong willingness to pay, soft mid-bottom competitive layer. This funds engine development.
2. **CRA as pack #2.** A very different domain from accessibility; proves the pack abstraction holds, and the affected population (every connected or software product sold in the EU) is enormous.
3. **Then EUDR or ESPR-DPP batteries**, chosen by which customer relationships form during packs #1 and #2.
4. **Hold CSRD, CSDDD, and CBAM** until the EU Omnibus simplification package settles — a pack built now could need major rework.

Battery passport was the origin design, but February 2027 timing and a narrower buyer make it a weaker pack #1 than accessibility.

## 7. Fit test for admitting a new pack

A regulation qualifies as a pack only when all are true:

- it decomposes into a finite, enumerable set of required items against a dated published standard;
- readiness depends on evidence and documentation, not primarily on calculation or on a third-party assessment;
- preparation requires gathering input from multiple internal owners and/or external parties;
- the deliverable is a dossier, statement, declaration, or export to an auditor, authority, customer, or filing system;
- the customer is legally responsible and benefits from a defensible, versioned record.

Explicitly excluded: real-time transactional compliance; pure calculation engines; anything whose core deliverable is a certificate issued by an accredited body.

## 8. Commercial model (hypotheses)

See the [engine Business Requirements](engine/BUSINESS_REQUIREMENTS.md) §12. Pricing is a discovery hypothesis, not a commitment.

- **Entry:** paid concierge "readiness sprint" — one regulation, one entity, structured evidence matrix, missing/conflict report, one export package, assisted review.
- **SaaS:** per-tenant subscription scaled by number of active regulations, entities, and evidence volume. External contributors (suppliers, reviewers) never pay and never consume a paid seat.
- **Expansion:** additional packs, onboarding and document migration, downstream export/filing integrations, private or region-specific deployment.
- Packs are the recurring-revenue engine: each new regulation is a new sellable module on the same platform, with shared infrastructure cost.

## 9. Docs structure (split complete)

The original battery-passport package has been reorganized:

```
docs/
  ENGINE_CONCEPT.md             # this document
  ARCHITECTURE_AWS.md           # concrete AWS implementation
  adr/                          # decision records
  engine/                       # vertical-neutral business, technical, and design requirements
    README.md
    BUSINESS_REQUIREMENTS.md
    TECHNICAL_REQUIREMENTS.md
    detailed-design/            # README + 01–05
  packs/
    README.md                   # pack registry + artifact contract
    espr-dpp-battery/           # original battery docs, preserved as the first pack
      BUSINESS_REQUIREMENTS.md · TECHNICAL_REQUIREMENTS.md · detailed-design/ · sources/
    eaa-accessibility/          # pack #1, to be written
```

The generalization applied (full mapping in [engine/README.md](engine/README.md) and [packs/espr-dpp-battery/README.md](packs/espr-dpp-battery/README.md)):

| Battery-specific term | Engine term |
| --- | --- |
| Battery model (`MOD-*`, `/models/`) | Regulated entity (`ENT-*`, `/entities/`) |
| Battery category (EV/LMT/industrial) | Entity classification facts |
| Commission data-point guidance | Source authority / published standard |
| Control snapshot `EC-BP-2026-08-15` | Control snapshot (pack-scoped key) |
| 71 data points | The pack's control set |
| Passport publisher / DPP Registry | Downstream consumer / filing target |
| LMT self-serve scope | First validated pack scope |
| Supplier (cell/pack/test) | External contributor (`SUPPLIER_CONTRIBUTOR`) |
| `EO_ADMIN` | `ORG_ADMIN` |

The readiness-state vocabulary, deterministic-engine rules, immutability rules, tenancy and token model, access classifications, and honest-claims discipline transfer unchanged. All `BR-*`, `TR-*`, `UC-*`, `AC-*`, `FSG-*` and most screen IDs are stable across both doc sets; the engine adds `BR-029` / `UC-023` / `AC-025` for multi-pack isolation.

## 10. Immediate next steps to begin building

1. ~~**Reframe the repo.**~~ Done — root `README.md` added; `docs/` split into `engine/` and `packs/` per section 9.
2. ~~**Write the EAA accessibility control pack spec.**~~ Drafted in [`docs/packs/eaa-accessibility/`](packs/eaa-accessibility/) — Ireland (S.I. 636/2023), EN 301 549 V3.2.1 / WCAG 2.1 AA core, entity-facts schema, applicability rules, evidence expectations, accessibility-statement export profile, copy / forbidden-claims, and a two-person source-review checklist. Reducing it to `packs/eaa-accessibility/*` artifacts is a Slice 1 + review `GATE`.
3. **Record engine ADRs** for the decisions in section 11 that block architecture ([ADR 0001](adr/0001-cloud-platform-aws.md) done).
4. **Stand up the engine skeleton** per the [engine Technical Requirements](engine/TECHNICAL_REQUIREMENTS.md) and [Implementation Handoff §3](engine/detailed-design/05_IMPLEMENTATION_HANDOFF.md): `apps/web`, `apps/api`, `apps/worker`, `packages/{domain,control-catalog,contracts,authorization,ui,test-fixtures,observability}`, `packs/`, `infra/`. Add a local dev environment (Docker Compose: Postgres + LocalStack) so development runs at zero AWS cost. Provision AWS foundations per [ARCHITECTURE_AWS.md](ARCHITECTURE_AWS.md) only when integration testing needs them.
5. **Implement Slice 0–1** (foundation, tenancy, pack loader and validator) from the [engine Implementation Handoff §7](engine/detailed-design/05_IMPLEMENTATION_HANDOFF.md), against the EAA pack.

## 11. Key open decisions

| Decision | Needed by |
| --- | --- |
| Working product name; whether "engine + packs" is customer-visible or internal framing only | Before marketing copy |
| Pack #1 target jurisdiction (which member state's EAA transposition) | Before writing the accessibility catalog |
| Accessibility scanner: in-house crawler vs. wrapped third-party engine (e.g. axe-core) — licensing and accuracy | Before EAA pack build |
| Cloud platform | **Decided: AWS, primary region `eu-west-1`** — see [ADR 0001](adr/0001-cloud-platform-aws.md) and [ARCHITECTURE_AWS.md](ARCHITECTURE_AWS.md) |
| Data residency: EU-only (AWS `eu-west-1`) vs. offering selectable or customer-dedicated regions | Selectable/dedicated regions deferred past MVP; revisit for enterprise |
| Remaining AWS specifics: Bedrock model/region, Fargate vs App Runner, RDS vs Aurora, malware scanner, CDK vs Terraform, Cognito vs external IdP | See [ARCHITECTURE_AWS.md](ARCHITECTURE_AWS.md) §11; before engine skeleton |
| Whether concierge-first applies to every pack or only pack #1 | Before commercial launch of pack #2 |
| Pricing unit: per regulation, per entity, per seat, per evidence volume, or a blend | Before paid pilots |
| Per-pack screen needs beyond the vertical-neutral set in `engine/detailed-design/` | Assessed per pack during its spec |
| Which downstream export profile each pack ships with at MVP | Per pack, during discovery |
