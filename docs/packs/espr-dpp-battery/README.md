# Pack: `ESPR-DPP-BATTERY`

**Regulation:** Regulation (EU) 2023/1542 concerning batteries and waste batteries — battery passport
**Source authority:** European Commission
**First control snapshot:** `EC-BP-2026-08-15` (Commission "Digital Batteries Passport — data points by category", version 2.0, 15 August 2026; 71 category-dependent data points)
**Status:** Origin design. Full requirements package present; not yet reduced to the standard pack artifacts in [../README.md](../README.md).

## Contents

| Document | Role |
| --- | --- |
| [BUSINESS_REQUIREMENTS.md](BUSINESS_REQUIREMENTS.md) | The original battery-vertical BRD. Source material for [`../../engine/BUSINESS_REQUIREMENTS.md`](../../engine/BUSINESS_REQUIREMENTS.md); retained as this pack's business context. |
| [TECHNICAL_REQUIREMENTS.md](TECHNICAL_REQUIREMENTS.md) | The original battery-vertical TRD. Source material for [`../../engine/TECHNICAL_REQUIREMENTS.md`](../../engine/TECHNICAL_REQUIREMENTS.md). |
| [detailed-design/](detailed-design/) | The original battery-vertical detailed design. The fully worked example the engine detailed design refers to. |
| [sources/](sources/) | Primary source: the Commission data-point guidance (PDF and extracted text). |

## Relationship to the engine

This package predates the engine framing. It is both:

1. **the design template for the engine** — the engine docs in [`../../engine/`](../../engine/) are generalized from it; and
2. **this pack's own requirements** — battery-specific scope, the 71-data-point control set, LMT-first self-serve boundary, passport-publisher export intent.

## ID mapping (battery doc → engine doc)

| Battery | Engine |
| --- | --- |
| `MOD-001` create battery model | `ENT-001` create regulated entity |
| `MOD-002` model overview | `ENT-002` entity overview |
| Route `/w/:workspaceId/models/:modelId` | `/w/:workspaceId/entities/:entityId` |
| "battery model" | "regulated entity" |
| "battery category" (EV/LMT/industrial) | "entity classification" |
| "data point" (71) | "control" (the pack's control set) |
| Control snapshot `EC-BP-2026-08-15` | the pack's control snapshot key |
| "passport publisher" / "DPP Registry" | "downstream consumer" / "filing target" |
| "supplier" (cell/pack/test) | "external contributor" |

All other IDs (`BR-*`, `TR-*`, `UC-*`, `AC-*`, `FSG-*`, `MAT-*`, `REQ-*`, `SUP-*`, `SUPP-*`, `REV-*`, `SNP-*`, `EXP-*`, `AUD-*`, `SET-*`, `EXT-*`, `DASH-*`, `DOC-*`, `AUTH-*`, `PUB-*`) are unchanged between the two.

## To reduce this pack to standard artifacts

Extract from the documents above into `packs/espr-dpp-battery/`: `manifest.json`, `controls.json` (the 71 records), `entity-facts.schema.json` (category, capacity, placing-on-market date, manufacture context), `applicability/` expressions, `export-profiles/` (canonical + a publisher profile), `validators/`, `copy/`, `test-vectors.json`, `source-notes.md`. Independent two-person source review is a `GATE` before production use.
