# Regulatory Readiness Engine — Requirements & Design

This folder holds the **vertical-neutral** requirements and design for the engine. It contains no regulation-specific content. Each regulation is defined by a **control pack** under [`../packs/`](../packs/).

## Reading order

| Document | Purpose |
| --- | --- |
| [../ENGINE_CONCEPT.md](../ENGINE_CONCEPT.md) | Platform framing: engine primitives, the control-pack contract, portfolio, sequencing |
| [BUSINESS_REQUIREMENTS.md](BUSINESS_REQUIREMENTS.md) | Customers, personas, jobs, business requirements (`BR-*`), readiness policy, commercial model, success gates, MVP acceptance |
| [TECHNICAL_REQUIREMENTS.md](TECHNICAL_REQUIREMENTS.md) | Architecture, domain model, control/version model, security (`TR-*`), extraction, APIs, nonfunctional targets, tests, feasibility gates (`FSG-*`) |
| [../ARCHITECTURE_AWS.md](../ARCHITECTURE_AWS.md) | Concrete AWS implementation of the technical requirements |
| [detailed-design/README.md](detailed-design/README.md) | Personas, information architecture, screens, states, responsive and accessibility contracts, traceability, acceptance (`AC-*`), implementation sequence |

## Origin

These documents are generalized from the EU battery-passport requirements package, which is preserved intact as the first control pack at [`../packs/espr-dpp-battery/`](../packs/espr-dpp-battery/). Where the engine docs need a worked, fully specified example, that pack is the reference.

## Terminology

| Engine term | Meaning | Battery-pack equivalent |
| --- | --- | --- |
| Regulated entity | The thing readiness is assessed for: a product, service, website, or organization | Battery model |
| Entity classification | Facts about the entity that drive applicability | Battery category (EV/LMT/industrial) |
| Control | One discrete required item decomposed from a regulation | Data point |
| Control snapshot | An immutable, dated version of a pack's control set | `EC-BP-2026-08-15` |
| Source authority | The body publishing the regulation or guidance | European Commission |
| External contributor (`SUPPLIER_CONTRIBUTOR`) | An outside party completing a scoped request without an account: supplier, vendor, agency, processor, partner | Cell/pack/test supplier |
| Downstream consumer | Where an approved export goes: auditor, authority, customer, filing system | Passport publisher / DPP Registry |
| Readiness snapshot | Immutable point-in-time evaluation of an entity against a control snapshot | (same term) |

Requirement, use-case, screen, acceptance, and feasibility-gate IDs (`BR-*`, `TR-*`, `UC-*`, `AC-*`, `FSG-*`, screen IDs) are stable and cross-referenced. Screen route segments use `entities` where the battery pack used `models`.
