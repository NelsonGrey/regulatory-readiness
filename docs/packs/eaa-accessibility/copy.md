# Copy — `eaa-accessibility`

Centralized strings for the pack. The engine renders readiness states from here;
the export generator and the release copy scan (AC-023) enforce the forbidden
list.

## Readiness-state labels (pack overrides)

The engine's generic labels are kept; the reason text is pack-specific, e.g.:

| State | Reason text pattern |
| --- | --- |
| `EVIDENCED` | "Checked against EN 301 549 {clause} (WCAG {sc}) on {date} by {reviewer}." |
| `MISSING` | "No accepted check exists for {clause} on the in-scope {surface}." |
| `STALE` | "The last check for {clause} predates the {date} release / is older than {interval}." |
| `CONDITIONAL` | "Covered by a disproportionate-burden claim pending assessment." |
| `NOT_APPLICABLE` | "{family} does not apply: {reason}." |

## Verdict phrasing (accessibility statement)

- Evidence-ready → **"Based on our preparation record, this service meets the
  accessibility requirements checked under EN 301 549 V3.2.1 (WCAG 2.1 AA), as of
  snapshot {key} ({date})."**
- Review needed / blocked → **"This service partially meets / does not yet meet
  the accessibility requirements. Known limitations are listed below."**

## Limitation statement (always shown)

> This is a preparation and evidence record, not a certification, a conformity
> assessment, or a legal opinion. It does not guarantee that an enforcement
> authority will agree. Responsibility for compliance with the European Union
> (Accessibility Requirements of Products and Services) Regulations 2023 remains
> with the service provider.

## Forbidden phrases (blocked in product copy and exports)

- "EAA certified", "EAA compliant", "Accessibility Act certified"
- "WCAG compliant", "WCAG 2.1 certified", "fully WCAG conformant"
- "fully accessible", "100% accessible", "guaranteed accessible"
- "legally compliant", "meets all legal requirements", "audit passed"
- "certified by {agency}" when only a report was received
- Any overlay-style claim ("instantly compliant", "one line of code")

## Permitted phrasing

- "meets the requirements checked under EN 301 549 V3.2.1"
- "conformance evidence prepared to WCAG 2.1 Level AA"
- "based on control snapshot {key}"
- "known limitations: …"

## Disclaimer (source)

Every screen showing a control cites: EN 301 549 V3.2.1 (2021-03); Directive (EU)
2019/882; S.I. No. 636 of 2023. The standard's and Directive's own status notes
are preserved and linked.
