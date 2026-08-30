# Entity facts — `eaa-accessibility`

The facts the applicability evaluator needs about a regulated entity (one product
or one service). Collected in the engine's `ENT-001` create flow. Unknown values
yield `CONDITIONAL_FACT_REQUIRED`, never a guess.

## Schema (draft for `entity-facts.schema.json`)

| Fact | Type | Notes |
| --- | --- | --- |
| `entityKind` | enum `product` \| `service` | Drives which Annex I sections and EN 301 549 chapters apply. |
| `serviceType` | enum (see below) \| `null` | Required when `entityKind = service`. |
| `productType` | enum (see below) \| `null` | Required when `entityKind = product`. |
| `offeredToConsumersInIE` | boolean | If false → `NOT_APPLICABLE` for the whole entity, reason recorded. |
| `operatorRole` | enum `provider` \| `manufacturer` \| `importer` \| `distributor` | Products have role-specific obligations; services have `provider`. |
| `isMicroEnterprise` | boolean | < 10 persons **and** annual turnover or balance sheet ≤ €2 000 000. |
| `microEnterpriseBasis` | object `{ staffCount, turnoverEUR, balanceSheetEUR, asOfDate }` | Evidence for the microenterprise determination. |
| `hasWebsite` | boolean | Gates EN 301 549 Chapter 9 (Web). |
| `hasMobileApp` | boolean | Gates EN 301 549 Chapter 11 (non-web software) for the app. |
| `providesDownloadableDocuments` | boolean | Gates EN 301 549 Chapter 10 (non-web documents). |
| `hasNonWebSoftware` | boolean | Desktop/embedded software beyond a website. |
| `usesSelfServiceTerminals` | boolean | Gates the self-service-terminal clauses (Annex I + EN 301 549 Chapter 8/5). |
| `terminalsInUseBefore20250628` | boolean | Transition: such terminals may continue to end of economic life (up to 20 years). |
| `usesProductsPlacedBefore20250628` | boolean | Service transition until 28 June 2030. |
| `providesRealTimeText` / `providesTwoWayVoice` / `providesVideo` | boolean | Electronic-communications and RTT clauses. |
| `disproportionateBurdenClaimed` | boolean | If true, requires a completed assessment (Annex VI) as evidence; specific requirements move to `CONDITIONAL`. |
| `fundamentalAlterationClaimed` | boolean | Same handling as disproportionate burden for the affected requirements. |
| `targetStandardVersion` | enum `EN301549-3.2.1` (default) | Selects the control snapshot's WCAG coupling. |

## `serviceType` enum

`ecommerce`, `consumer_banking`, `ebooks_and_reading_software`,
`electronic_communications`, `access_to_avms` (websites/apps/EPGs for audiovisual
media services), `passenger_transport_air`, `passenger_transport_bus`,
`passenger_transport_rail`, `passenger_transport_waterborne`,
`emergency_communications_112` (deferred — routes to `NEEDS_SPECIALIST_REVIEW`).

## `productType` enum

`general_purpose_computer_os`, `payment_terminal`, `self_service_terminal_atm`,
`self_service_terminal_ticketing`, `self_service_terminal_checkin`,
`interactive_info_terminal`, `consumer_terminal_equipment_ecs`,
`consumer_terminal_equipment_avms`, `e_reader`.

## Derived flags (computed, not entered)

- `microServiceExempt` = `entityKind = service` **and** `isMicroEnterprise` — the
  entity's substantive controls become `NOT_APPLICABLE` with the exemption reason;
  the microenterprise-basis evidence and an EAA awareness note remain required.
  (Microenterprises dealing with **products** are **not** fully exempt — only
  relieved of some documentation duties.)
- `transitionActive` = any of the `…Before20250628` / `…Before…2030` facts true —
  affected controls carry a dated transition note rather than a blocker.
