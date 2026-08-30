# Pack: `eaa-accessibility` (spec)

**Regulation:** Directive (EU) 2019/882 — European Accessibility Act (EAA)
**Source authority:** European Union (Directive); European Commission and CEN/CENELEC/ETSI (harmonised standard)
**Jurisdiction (pack #1 target):** Ireland — European Union (Accessibility Requirements of Products and Services) Regulations 2023 (S.I. No. 636 of 2023)
**Technical basis:** EN 301 549 (harmonised ICT accessibility standard), which incorporates WCAG for web content, documents, and non-web software
**Application date:** 28 June 2025
**Status:** Specification draft. Not yet reduced to the standard pack artifacts; the control transcription is a `GATE` requiring independent two-person source review (engine TRD §22.4).

> This pack prepares evidence that a product or service meets the EAA's accessibility requirements. It does not certify accessibility, does not guarantee conformity, and is not a legal opinion. "Evidenced" means the customer's record contains approved, source-linked information — see [copy.md](copy.md).

## Why this pack is first

Largest near-term EU market with live enforcement (since 28 June 2025), strong willingness to pay (replaces €5k–50k agency remediation work), a soft mid-bottom competitive layer (overlay widgets are discredited; enterprise auditing tools are expensive), and a control core (EN 301 549 / WCAG) that is stable and well documented. See [ENGINE_CONCEPT §6](../../ENGINE_CONCEPT.md).

## What this pack covers

| In scope | Out of scope |
| --- | --- |
| EAA **services**: e-commerce, consumer banking, e-books & reading software, electronic communications, access to audiovisual media services, elements of passenger transport services (websites, apps, e-tickets, real-time info, interactive terminals) | The accessibility of audiovisual **content** itself (covered by the AVMS Directive) |
| EAA **products** where the customer is a manufacturer/importer/distributor: self-service terminals, payment terminals, e-readers, consumer terminal equipment, general-purpose computers | Built environment (optional under the EAA; Ireland has not mandated it) |
| The functional performance requirements (Annex I) and the service information / accessibility-statement requirements (Annex I Section III–IV, Annex V) | Emergency-communications (112) handling by PSAPs — specialist, deferred |
| Conformity evidence: automated scans, manual audits, assistive-technology testing, supplier declarations (VPAT/ACR), procurement records, remediation tracking | Disproportionate-burden **assessment** as a legal conclusion — the pack records the assessment and its evidence; it does not decide it |

## Documents in this spec

| File | Purpose |
| --- | --- |
| [manifest.md](manifest.md) | Values for `manifest.json` — sources, dates, checksums, versions |
| [entity-facts.md](entity-facts.md) | The classification facts the applicability evaluator needs |
| [controls.md](controls.md) | Control decomposition: EN 301 549 chapters + Annex I → control families and keys |
| [applicability.md](applicability.md) | Which control families apply given the entity facts |
| [evidence.md](evidence.md) | What evidence satisfies each control family |
| [export-profile.md](export-profile.md) | The accessibility statement + evidence index output |
| [copy.md](copy.md) | Readiness labels, limitation language, forbidden claims, disclaimer |
| [source-notes.md](source-notes.md) | Primary sources, retrieval status, ambiguities, two-person review checklist |

## Relationship to the engine

This pack plugs into the vertical-neutral engine ([`docs/engine/`](../../engine/)) as data. The engine provides the catalog loader, applicability evaluator, readiness states, evidence store, contributor portal (for supplier VPATs / agency audits), review workflow, snapshots, export, and audit. This pack provides: the control set, the entity-facts schema, the applicability rules, the export profile, the validators, and the copy.

Regulated entity for this pack = **one product or one service** offered to consumers in Ireland.
