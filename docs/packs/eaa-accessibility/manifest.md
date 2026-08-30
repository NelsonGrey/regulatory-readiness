# `manifest.json` values — `eaa-accessibility`

Draft values for the pack manifest (schema: `@rre/contracts` `PackManifest`). Every
URL, date, and checksum below is a `GATE` item: confirmed and hashed during
two-person source review before the pack is activated in production.

```jsonc
{
  "packKey": "eaa-accessibility",
  "title": "EU Accessibility Act (Directive 2019/882) — Ireland",
  "sourceAuthority": "European Union / European Commission; ETSI-CEN-CENELEC (EN 301 549)",
  "jurisdiction": "IE",
  "sourceUrls": [
    "https://eur-lex.europa.eu/eli/dir/2019/882/oj",            // EAA Directive
    "https://www.irishstatutebook.ie/eli/2023/si/636/made/en",   // S.I. No. 636 of 2023 (IE transposition)
    "https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf", // EN 301 549 V3.2.1
    "https://www.w3.org/TR/WCAG21/",                             // WCAG 2.1 (referenced by EN 301 549 V3.2.1)
    "https://www.w3.org/TR/WCAG22/"                              // WCAG 2.2 (forward-looking)
  ],
  "publicationDate": "2019-04-17",       // EAA adoption
  "retrievedDate": "TBD",                // set at review time
  "sourceChecksum": "TBD",               // sha256 over the canonical source set
  "catalogVersion": "0.1.0",
  "effectiveDates": [
    { "label": "EAA application date", "date": "2025-06-28" },
    { "label": "Service transition — products in use before application date", "date": "2030-06-28" }
  ],
  "supersedes": null,
  "supersededBy": null,
  "status": "draft"
}
```

## Control-snapshot key

Snapshot key format: `EAA-IE-EN549-V3.2.1-<YYYY-MM-DD>` where the date is the
`retrievedDate`. A new EN 301 549 version, a WCAG update adopted by the standard,
or an amendment to S.I. 636/2023 produces a **new immutable snapshot**, never an
edit.

## Version coupling notes

- **EN 301 549 V3.2.1 (2021-03)** is the current harmonised-standard basis and
  references **WCAG 2.1 Level A + AA**. A later EN 301 549 version aligned to
  WCAG 2.2 is expected; when it is cited in the Official Journal, it becomes a new
  snapshot. Until then WCAG 2.2-only success criteria are carried as
  `OPTIONAL_IF_AVAILABLE` (see [controls.md](controls.md)).
- The Irish enforcement-authority mapping (see [source-notes.md](source-notes.md))
  is provisional and is a review `GATE`.
