# `eaa-accessibility` — source notes (runtime pack)

**Status: `draft`.** This bundle is a starter, not a reviewed catalog.

- 20 controls transcribed as a representative sample. The full EN 301 549 V3.2.1
  transcription (every applicable WCAG 2.1 A + AA success criterion in chapters
  9–11, plus the hardware and support clauses) is a `GATE` — see ADR 0005 and the
  full checklist in [`docs/packs/eaa-accessibility/source-notes.md`](../../docs/packs/eaa-accessibility/source-notes.md).
- `sourceChecksum` is `sha256:UNVERIFIED`; `retrievedDate` is `TBD`. The loader
  emits a **warning** for these while `status` is `draft`/`in-review`, and an
  **error** once `status` is `active`.
- The Irish enforcement-authority mapping is not yet encoded (it belongs in the
  `accessibility-statement` export profile) and is a review `GATE`.

## Activation checklist (two-person review)

1. Retrieve, date, and SHA-256 every source in `manifest.json`; set `retrievedDate`
   and `sourceChecksum` (recompute against the loader's canonical form).
2. Transcribe the full control set; update `test-vectors.json.controlCount`.
3. Confirm applicability rules against S.I. 636/2023 (micro-enterprise thresholds,
   transition dates, product-vs-service split).
4. Confirm the enforcement-authority mapping per service/product type.
5. Record reviewer names, `reviewedAt`, and `sourceSetHash` in `manifest.review`;
   set `status` to `active`.
