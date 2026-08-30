# Control Packs

A **control pack** encodes one regulation as data plus a small amount of declared logic, plugged into the vertical-neutral engine. The engine provides catalog management, applicability evaluation, readiness states, evidence and provenance, the external collection portal, review workflow, snapshots, export, audit, tenancy, and access classification. A pack provides the regulation.

The pack contract (required artifacts, governance) is defined in [../ENGINE_CONCEPT.md §5](../ENGINE_CONCEPT.md). The fit test for admitting a new pack is [§7](../ENGINE_CONCEPT.md).

## Registry

| Pack key | Regulation | Status | Folder |
| --- | --- | --- | --- |
| `eaa-accessibility` | EU Accessibility Act (Directive 2019/882), Ireland | **Pack #1 — spec drafted; `draft` runtime bundle at `packs/eaa-accessibility/` loads + validates; full transcription is a `GATE`** | [eaa-accessibility/](eaa-accessibility/) |
| `espr-dpp-battery` | EU Batteries Regulation (2023/1542) — battery passport | Origin design; full requirements package, not yet reduced to artifacts | [espr-dpp-battery/](espr-dpp-battery/) |
| `cra` | Cyber Resilience Act | Proposed pack #2 | _pending_ |

Sequencing and the wider candidate portfolio are in [../ENGINE_CONCEPT.md §6](../ENGINE_CONCEPT.md).

## Required artifacts per pack

```text
packs/<pack-key>/
  manifest.json            # pack key, source URLs, publication/guidance date, retrieval date,
                           # source checksum, catalog version, jurisdiction, effective dates
  controls.json            # enumerated controls: stable key, official id/name, source citation,
                           # field family, value type/unit/method, evidence expectation,
                           # access-class default, compiled applicability expression
  entity-facts.schema.json # facts the applicability evaluator needs
  applicability/           # deterministic expressions over entity facts + snapshot
  export-profiles/         # canonical JSON always; authority-specific profiles optional
  validators/              # deterministic field-family validators
  copy/                    # readiness-state labels, limitation language, forbidden claims, disclaimer
  test-vectors.json        # known applicability/readiness outcomes, control count, checksum
  source-notes.md          # transcription notes, ambiguities, two-person review record
```

**Governance.** Every production pack requires an independent two-person source review (`GATE`). A corrected pack is a new immutable snapshot even if the source date is unchanged.
