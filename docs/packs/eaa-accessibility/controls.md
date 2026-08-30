# Controls — `eaa-accessibility`

## Decomposition approach

The EAA states outcome requirements (Annex I); **EN 301 549** is the harmonised
standard that gives a presumption of conformity. The pack's control set is
therefore built from EN 301 549 clauses, grouped by the standard's chapters, plus
a small set of EAA-specific service-information and process controls that EN 301 549
does not cover.

Each control is one testable requirement with: a stable key, the EN 301 549 clause
(and the WCAG success criterion where applicable), the applicable chapter, the
field family, the evidence expectation, and an access-class default of
`PUBLIC_CANDIDATE` (accessibility conformance information is intended for public
disclosure).

**Full transcription is a `GATE`** — the ~90 WCAG A/AA success criteria plus the
non-web and hardware clauses are transcribed and checked by two reviewers against
EN 301 549 V3.2.1 and S.I. 636/2023 before activation ([source-notes.md](source-notes.md)).
The tables below define the scheme and give a representative sample.

## Key scheme

| Pattern | Meaning | Example |
| --- | --- | --- |
| `EAA-EN549-<clause>` | An EN 301 549 clause, dots → dashes | `EAA-EN549-9-1-1-1` (Web, WCAG 1.1.1 Non-text Content) |
| `EAA-A1-<n>` | An Annex I functional-performance statement | `EAA-A1-USAGE-WITHOUT-VISION` |
| `EAA-SVC-<topic>` | An EAA service-provision / information requirement | `EAA-SVC-ACCESSIBILITY-STATEMENT` |
| `EAA-PROD-<topic>` | An EAA product documentation / marking requirement | `EAA-PROD-EU-DECLARATION` |
| `EAA-PROC-<topic>` | A process / assessment requirement | `EAA-PROC-DISPROPORTIONATE-BURDEN` |

## Control families

| Family | EN 301 549 chapter / EAA source | Applies when |
| --- | --- | --- |
| Functional performance | Annex I / EN 301 549 clause 4 | Always (as outcome context) |
| Generic ICT requirements | EN 301 549 clause 5 (closed functionality, hardware, biometrics) | `usesSelfServiceTerminals` or hardware products |
| ICT with two-way voice / video / RTT | EN 301 549 clauses 6, 7 | `providesTwoWayVoice` / `providesVideo` / `providesRealTimeText` |
| Web | EN 301 549 clause 9 (= WCAG 2.1 A + AA) | `hasWebsite` |
| Non-web documents | EN 301 549 clause 10 | `providesDownloadableDocuments` |
| Non-web software | EN 301 549 clause 11 | `hasMobileApp` or `hasNonWebSoftware` |
| Support services & docs | EN 301 549 clauses 12, 13 | Always (help, relay, accessible support) |
| Service information & statement | EAA Annex I Section III–IV, Annex V | `entityKind = service` |
| Product documentation & marking | EAA Annex I Section I–II, Annex II/IV | `entityKind = product` |
| Process | EAA Art. 14, Annex VI | `disproportionateBurdenClaimed` or `fundamentalAlterationClaimed` |

## Representative controls (sample)

| Key | Requirement (short) | WCAG SC | Family | Field family |
| --- | --- | --- | --- | --- |
| `EAA-EN549-9-1-1-1` | Web: non-text content has a text alternative | 1.1.1 A | Web | `web-sc-check` |
| `EAA-EN549-9-1-4-3` | Web: text contrast ≥ 4.5:1 (3:1 large) | 1.4.3 AA | Web | `web-sc-check` |
| `EAA-EN549-9-2-1-1` | Web: all functionality operable by keyboard | 2.1.1 A | Web | `web-sc-check` |
| `EAA-EN549-9-2-4-7` | Web: visible focus indicator | 2.4.7 AA | Web | `web-sc-check` |
| `EAA-EN549-9-4-1-2` | Web: name, role, value exposed to assistive tech | 4.1.2 A | Web | `web-sc-check` |
| `EAA-EN549-10-1-1-1` | Downloadable documents: non-text alternatives | 1.1.1 (doc) | Non-web documents | `doc-sc-check` |
| `EAA-EN549-11-1-1-1` | Mobile app: non-text alternatives | 1.1.1 (sw) | Non-web software | `sw-sc-check` |
| `EAA-EN549-11-5-2-3` | Mobile app: exposes accessibility services of the platform | — | Non-web software | `sw-sc-check` |
| `EAA-EN549-5-1-3-1` | Closed functionality (terminal): operable without vision | — | Generic ICT | `hardware-check` |
| `EAA-EN549-5-1-4` | Terminal: privacy when using accessibility features | — | Generic ICT | `hardware-check` |
| `EAA-EN549-8-3-2` | Self-service terminal: tactile / audio output | — | Generic ICT | `hardware-check` |
| `EAA-EN549-12-2-4` | Support services communicate via accessible means | — | Support services | `presence-check` |
| `EAA-A1-USAGE-WITHOUT-VISION` | Service usable with no vision (outcome) | — | Functional performance | `outcome-attestation` |
| `EAA-SVC-ACCESSIBILITY-STATEMENT` | Publicly available explanation of how the service meets the requirements (Annex V) | — | Service information | `document-presence` |
| `EAA-SVC-INFO-IN-ACCESSIBLE-FORMAT` | The accessibility information itself is provided in an accessible format | — | Service information | `document-presence` |
| `EAA-PROC-DISPROPORTIONATE-BURDEN` | Completed, documented assessment (Annex VI) where burden is claimed | — | Process | `assessment-record` |
| `EAA-PROD-EU-DECLARATION` | EU declaration of conformity drawn up (products) | — | Product documentation | `document-presence` |
| `EAA-PROD-CE-MARKING` | CE marking affixed (products) | — | Product documentation | `attestation` |

## WCAG 2.2 forward-looking

Success criteria new in WCAG 2.2 (e.g. 2.4.11 Focus Not Obscured, 2.5.7 Dragging
Movements, 2.5.8 Target Size (Minimum), 3.2.6 Consistent Help, 3.3.7 Redundant
Entry, 3.3.8 Accessible Authentication) are included with applicability
`OPTIONAL_IF_AVAILABLE` under the `EN301549-3.2.1` snapshot. They become
`REQUIRED_BY_SNAPSHOT` in the snapshot that cites an EN 301 549 version referencing
WCAG 2.2.
