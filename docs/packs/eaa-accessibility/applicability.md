# Applicability rules — `eaa-accessibility`

Deterministic expressions over [entity facts](entity-facts.md) plus the selected
snapshot. Output is one of the engine's applicability results (engine TRD §7.2).
Unknown facts → `CONDITIONAL_FACT_REQUIRED`.

## Entity-level gates (evaluated first)

| Condition | Result for the whole entity |
| --- | --- |
| `offeredToConsumersInIE = false` | `NOT_APPLICABLE_TO_CLASSIFICATION`, reason "not offered to consumers in Ireland" |
| `serviceType = emergency_communications_112` | `NEEDS_SPECIALIST_REVIEW` |
| `microServiceExempt = true` (service micro-enterprise) | Substantive control families → `NOT_APPLICABLE_TO_CLASSIFICATION`, reason "micro-enterprise service exemption (EAA Art. 4(5))"; keep `EAA-PROC-MICRO-BASIS` (evidence of the determination) and `EAA-SVC-AWARENESS` required |

## Family-level rules

| Control family | Applicable when | Otherwise |
| --- | --- | --- |
| Web (`EAA-EN549-9-*`) | `hasWebsite = true` | `NOT_APPLICABLE_TO_CLASSIFICATION` ("no website in scope") |
| Non-web documents (`EAA-EN549-10-*`) | `providesDownloadableDocuments = true` | `NOT_APPLICABLE_TO_CLASSIFICATION` |
| Non-web software (`EAA-EN549-11-*`) | `hasMobileApp = true` OR `hasNonWebSoftware = true` | `NOT_APPLICABLE_TO_CLASSIFICATION` |
| Two-way voice / video / RTT (`EAA-EN549-6-*`, `7-*`) | the matching `providesTwoWayVoice` / `providesVideo` / `providesRealTimeText` fact is true | `NOT_APPLICABLE_TO_CLASSIFICATION` |
| Generic ICT / hardware (`EAA-EN549-5-*`, `8-*`) | `usesSelfServiceTerminals = true` OR `entityKind = product` | `NOT_APPLICABLE_TO_CLASSIFICATION` |
| Support services (`EAA-EN549-12-*`, `13-*`) | always (for in-scope entities) | — |
| Functional performance (`EAA-A1-*`) | always (outcome context) | — |
| Service information & statement (`EAA-SVC-*`) | `entityKind = service` | `NOT_APPLICABLE_TO_CLASSIFICATION` |
| Product documentation & marking (`EAA-PROD-*`) | `entityKind = product` AND `operatorRole ∈ {manufacturer, importer}` | distributor → reduced set; service → `NOT_APPLICABLE` |
| Process (`EAA-PROC-DISPROPORTIONATE-BURDEN`) | `disproportionateBurdenClaimed = true` OR `fundamentalAlterationClaimed = true` | `NOT_APPLICABLE_TO_CLASSIFICATION` |

## Control-level modifiers

| Condition | Effect on the affected controls |
| --- | --- |
| `disproportionateBurdenClaimed = true` | The specific EN 301 549 controls named in the assessment move to `CONDITIONAL_FACT_REQUIRED` until `EAA-PROC-DISPROPORTIONATE-BURDEN` is `EVIDENCED`; then they read `NOT_YET_REQUIRED_BY_SNAPSHOT` with the assessment cited. The burden claim must be re-assessed at least every 5 years (staleness rule). |
| `terminalsInUseBefore20250628 = true` | Terminal hardware controls carry a transition note; not blocking until end of economic life / 20 years. |
| `usesProductsPlacedBefore20250628 = true` | Affected service controls carry a transition note dated 2030-06-28; not blocking until then. |
| WCAG 2.2-only success criteria under snapshot `EN301549-3.2.1` | `OPTIONAL_IF_AVAILABLE` |
| Duplicate coverage (e.g. a WCAG SC met once for a page template used site-wide) | `DUPLICATE_SOURCE_FIELD` when the evidence explicitly references the shared template |

## Expression example

```json
{
  "all": [
    { "fact": "entity.hasWebsite", "in": [true] },
    { "fact": "entity.microServiceExempt", "in": [false] },
    { "snapshot": "EAA-IE-EN549-V3.2.1" }
  ],
  "result": "REQUIRED_BY_SNAPSHOT"
}
```
