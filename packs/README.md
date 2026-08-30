# packs (runtime data)

Installable control packs as loaded by `@rre/control-catalog`. Each pack is an
immutable data bundle; see the artifact contract in
[docs/packs/README.md](../docs/packs/README.md) and
[ENGINE_CONCEPT.md §5](../docs/ENGINE_CONCEPT.md).

```text
packs/<pack-key>/
  manifest.json
  controls.json
  entity-facts.schema.json
  applicability/
  export-profiles/
  validators/
  copy/
  test-vectors.json
  source-notes.md
```

| Pack key | Status |
| --- | --- |
| `eaa-accessibility` | **`draft` bundle present** (20-control starter, 16 applicability rules, 5 known-outcome vectors); loads + validates via `@rre/control-catalog`. Full transcription + two-person review is the activation `GATE`. Spec: [docs/packs/eaa-accessibility/](../docs/packs/eaa-accessibility/). |
| `espr-dpp-battery` | origin design; documented at [docs/packs/espr-dpp-battery/](../docs/packs/espr-dpp-battery/), not yet reduced to artifacts |

A production pack requires an independent two-person source review (`GATE`) before activation.
