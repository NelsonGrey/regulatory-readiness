# ADR 0001 — Build on AWS (Amazon Web Services)

**Status:** Accepted (proposed baseline)
**Date:** August 30, 2026
**Owner:** Mark Nelson
**Supersedes:** none
**Related:** [ENGINE_CONCEPT.md](../ENGINE_CONCEPT.md) §10–§11, [engine/TECHNICAL_REQUIREMENTS.md](../engine/TECHNICAL_REQUIREMENTS.md) §4 and §26, [ARCHITECTURE_AWS.md](../ARCHITECTURE_AWS.md)

## Context

The Technical Requirements describe a provider-neutral stack (S3-compatible storage, a managed queue, an OIDC identity provider, OCR/LLM adapters, an EU-region managed container platform) and defer the concrete platform choice (§26: "EU-only versus selectable data region", "OCR/LLM providers and processing region"). A platform must now be chosen so engine foundations can be provisioned.

Binding requirements that shape the choice:

- EU data residency for all customer data and evidence, storage and processing.
- Provider portability: identity, object storage, OCR/LLM, email, and export sit behind internal interfaces (TRD architecture principle 9). The platform is an implementation, not the domain model.
- Tenant isolation by construction; least privilege; immutable history; fail-closed.
- Operable by a small team — managed services strongly preferred over self-managed infrastructure.

## Decision

Build the Regulatory Readiness Engine on **AWS**.

- **Primary region:** `eu-west-1` (Ireland). See [ARCHITECTURE_AWS.md](../ARCHITECTURE_AWS.md) §3 for rationale (SES inbound email availability, Textract, Bedrock, Aurora/RDS, and EU residency in one region).
- **Account topology:** AWS Organizations with separate accounts per environment plus dedicated security/log-archive and shared-services accounts; Service Control Policies restrict usage to approved EU regions.
- **Managed-first:** ECS Fargate, RDS/Aurora PostgreSQL, S3, SQS/EventBridge, Cognito, SES, Textract, Bedrock, GuardDuty, CloudWatch/X-Ray.
- **Portability preserved at the adapter layer only.** Swapping a provider means writing new adapters behind existing interfaces, not redesigning the domain. It does not mean staying cloud-agnostic in operations or IaC.

## Options considered

| Option | For | Against |
| --- | --- | --- |
| **AWS** (chosen) | Widest managed-service coverage for this workload (SES inbound, Textract OCR, Bedrock LLM, GuardDuty malware scanning for S3, S3 Object Lock for immutability, Organizations multi-account isolation); mature IAM, CloudTrail, Config, Security Hub; multiple EU regions; team preference | AWS-specific IaC and operational knowledge; multi-account setup is upfront work; NAT/Fargate/RDS cost baselines; some services region-limited |
| GCP | Strong data/AI services; simple project isolation | Fewer EU-region specifics for inbound email; smaller compliance-tooling ecosystem for this pattern; no team preference |
| Azure | Strong EU public-sector positioning | Heavier for a small team; no team preference |
| Small PaaS (Fly.io / Render / Railway) | Fastest to a running app; low ops | Weak fit for evidence-immutability, malware scanning, multi-account tenant isolation, EU-residency guarantees, and audit tooling; would be replaced later |

## Consequences

- Infrastructure as code is AWS CDK (TypeScript), matching the monorepo language; Terraform remains an acceptable alternative.
- SES inbound email constrains the region choice; `eu-west-1` is confirmed to support it. Any alternative region must be checked against the current SES inbound region list.
- Amazon Bedrock model availability (Claude) in the primary region is a **`GATE`** for the extraction feature — verify before enabling `document_extraction`. If the required model is only in another EU region, a documented intra-EU data-flow review is required.
- Selectable or customer-dedicated regions ("silo" tenancy) are out of MVP scope, but the account-per-environment structure is designed so account-per-tenant is a later extension, not a rewrite.
- Cost profile carries always-on baselines (Fargate, Multi-AZ RDS, NAT gateway, CloudFront/WAF) before any document-processing volume — sized in [ARCHITECTURE_AWS.md](../ARCHITECTURE_AWS.md) §16 and refined in feasibility gate FSG-001.
