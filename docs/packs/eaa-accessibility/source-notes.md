# Source notes & review checklist — `eaa-accessibility`

Everything in this pack spec is drafted from working knowledge and **must be
verified against primary sources** before the pack is activated. This file is the
`source-notes.md` seed and the two-person review record (engine TRD §22.4).

## Primary sources to confirm and hash

| # | Source | What to confirm | Status |
| --- | --- | --- | --- |
| 1 | Directive (EU) 2019/882 (EAA), consolidated text on EUR-Lex | Scope lists (Art. 2), definitions, Annex I requirements, Annex V info requirements, Annex VI burden criteria, Art. 4(5) micro-enterprise exemption, transition dates (Art. 32) | ☐ |
| 2 | S.I. No. 636 of 2023 — European Union (Accessibility Requirements of Products and Services) Regulations 2023 (Irish Statute Book) | Designated **enforcement / market-surveillance authorities per service and product type**; feedback and complaint route; any national derogations; penalties | ☐ |
| 3 | EN 301 549 V3.2.1 (2021-03), ETSI | Exact clause numbering per chapter; the WCAG 2.1 mapping in clauses 9–11; hardware clauses 5, 8; support clauses 12–13; whether a newer version (V4.x) is cited in the EU Official Journal | ☐ |
| 4 | WCAG 2.1 (W3C Recommendation) | The A + AA success-criteria list referenced by EN 301 549 V3.2.1 | ☐ |
| 5 | WCAG 2.2 (W3C Recommendation, Oct 2023) | The delta SC carried as `OPTIONAL_IF_AVAILABLE` | ☐ |
| 6 | Commission Implementing Decision (EU) 2018/1523 (model accessibility statement, Web Accessibility Directive) | Used only as a **template reference** for the export profile — note it is not the EAA's own instrument | ☐ |
| 7 | Any Irish guidance (e.g. from the National Disability Authority / Centre for Excellence in Universal Design) | Interpretive guidance; not law | ☐ |

## Known ambiguities / decisions for review

1. **Irish enforcement-authority mapping is provisional.** The pack must record,
   per `serviceType` / `productType`, which authority in S.I. 636/2023 has
   surveillance and complaint jurisdiction (candidates include CCPC, ComReg, the
   Central Bank of Ireland, and others). Do not ship the accessibility-statement
   "enforcement route" text until confirmed.
2. **EN 301 549 version.** Spec assumes V3.2.1 (WCAG 2.1). If a WCAG 2.2-aligned
   version is cited in the OJ before build, start from that and drop the
   forward-looking carve-out in [controls.md](controls.md).
3. **Micro-enterprise exemption applies to services only.** Confirm the exact
   thresholds and the reference period, and that product micro-enterprises retain
   substantive (not documentation) duties.
4. **Disproportionate burden** is the customer's assessment to make and defend.
   The pack records it and its evidence; it must not present a verdict. Confirm
   the Annex VI criteria list and the 5-year re-assessment expectation.
5. **Transition dates.** Confirm 28 June 2030 (services using pre-existing
   products) and the self-service-terminal ≤ 20-year rule wording.
6. **"Regulated entity = one product or one service."** Confirm this granularity
   works for customers with, e.g., one website spanning e-commerce + banking —
   may need multiple entities or a multi-serviceType entity.

## Two-person review checklist (activation `GATE`)

- [ ] Every source above retrieved, dated, and SHA-256 hashed into the source set.
- [ ] `controls.json` transcribed: every WCAG 2.1 A + AA SC present exactly once
      per applicable chapter (9, 10, 11); hardware and support clauses present.
- [ ] Control count recorded in `test-vectors.json`; loader count check passes.
- [ ] Applicability rules produce the expected result for: a micro-enterprise
      e-commerce service; a large bank website + app; a ticketing terminal
      manufacturer; a service not offered in IE.
- [ ] Forbidden-phrase list reviewed by someone familiar with EAA enforcement risk.
- [ ] Enforcement-authority mapping confirmed against S.I. 636/2023 by both reviewers.
- [ ] Reviewer names, date, and source-set hash recorded in `manifest.json`.
