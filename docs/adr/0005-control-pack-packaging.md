# ADR 0005 — Control-pack packaging and versioning

**Status:** Accepted (proposed baseline)
**Date:** August 30, 2026
**Related:** [ENGINE_CONCEPT.md](../ENGINE_CONCEPT.md) §5; [engine/TECHNICAL_REQUIREMENTS.md](../engine/TECHNICAL_REQUIREMENTS.md) §7, §22.4; [docs/packs/README.md](../packs/README.md)

## Context

A control pack encodes one regulation as data. It must be reviewable, diffable, versioned, content-addressed, and loadable without a code change (engine principle 3). It must never be edited in place once activated.

## Decision

- **Format.** A pack is a checked-in directory `packs/<pack-key>/` of JSON plus Markdown notes:

  ```
  manifest.json · controls.json · entity-facts.schema.json
  applicability/rules.json · export-profiles/*.json · validators/*.json
  copy/strings.json · test-vectors.json · source-notes.md
  ```

- **Loading.** `@rre/control-catalog` reads and Zod-validates every file at process start (and in CI). A pack that fails validation is not activated; the process logs the issues and serves other packs.
- **Content addressing.** `sourceChecksum` in `manifest.json` is `sha256` over the canonical (sorted-key, normalised) concatenation of the pack's data files. The loader recomputes it and refuses a mismatch.
- **Snapshots.** The control-snapshot key embeds the pack key, the standard version, and the retrieval date. **Any** change to a data file — even a typo fix, even with the same source date — produces a **new immutable snapshot**; historical snapshots are never mutated.
- **Activation gate.** `manifest.status` moves `draft → in-review → active`. `active` requires an independent two-person source review whose reviewer names, date, and source-set hash are recorded in `manifest.json` (engine TRD §22.4). Non-production environments may run `draft`/`in-review` packs behind a feature flag.
- **Distribution.** Packs ship inside the application image at MVP. A separate pack registry/service is deferred.

## Consequences

- Pack authorship is a documentation-and-review workflow, not a deploy; a pack PR is reviewed like code.
- The loader's validation suite (count, unique keys, referential integrity, rule compilation, known-outcome vectors, checksum) is the pack's test surface and runs in CI.
- Editing an active pack file in place is a defect caught by the checksum check and by the "new snapshot" rule in review.
- Large packs increase image size; acceptable at MVP, revisit if it becomes material.
