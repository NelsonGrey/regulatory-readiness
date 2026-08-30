# Regulatory Readiness Engine — AWS Architecture

**Document type:** Reference Architecture
**Version:** 0.1
**Status:** Proposed / discovery
**Last updated:** August 30, 2026
**Owner:** Mark Nelson

Related documents: [ENGINE_CONCEPT.md](ENGINE_CONCEPT.md), [engine/TECHNICAL_REQUIREMENTS.md](engine/TECHNICAL_REQUIREMENTS.md), [engine/detailed-design/05_IMPLEMENTATION_HANDOFF.md](engine/detailed-design/05_IMPLEMENTATION_HANDOFF.md), [ADR 0001 — Build on AWS](adr/0001-cloud-platform-aws.md), [DEVELOPMENT.md](DEVELOPMENT.md) (local-first dev + free-tier cost control)

> This document maps the engine primitives ([ENGINE_CONCEPT.md §4](ENGINE_CONCEPT.md)) and the [engine Technical Requirements](engine/TECHNICAL_REQUIREMENTS.md) "Technology shape" (§4) and nonfunctional targets (§19) onto concrete AWS services. It replaces the generic stack table for infrastructure decisions only. Language-independent requirements, the domain model, and acceptance criteria are unchanged.

---

## 1. Guiding constraints

1. **EU data residency.** All customer data, evidence, derivatives, backups, and provider processing stay in EU regions.
2. **Provider portability at the adapter layer.** Identity, object storage, OCR/LLM, email, and export sit behind internal interfaces. AWS is the default implementation, not the domain model.
3. **Tenant isolation by construction.** Every tenant-owned row and object carries a tenant ID; isolation is enforced in the application, the database (RLS), storage paths, queues, caches, and logs.
4. **Immutable history.** Originals, snapshots, and audit records are append-only; storage enforces it where practical (S3 Object Lock).
5. **Fail-closed.** Disabled feature flags and failed authorization deny at route, service, worker, and storage layers.
6. **Small-team operability.** Managed services are preferred over anything self-hosted.

## 2. High-level shape

```text
                       CloudFront + AWS WAF + Shield
                                   │
             ┌─────────────────────┴─────────────────────┐
             │                                           │
      S3 (SPA static)                            ALB (private) ──► ECS Fargate: API
   operator / supplier / reviewer                                   │
                                                                    ├─ RDS/Aurora PostgreSQL (Multi-AZ, RLS)
                                                                    ├─ S3: originals (Object Lock) / derivatives / exports / quarantine / inbound-email
                                                                    ├─ SQS queues (+ DLQs)  ◄─ transactional outbox ─► EventBridge / SNS
                                                                    ├─ Secrets Manager · KMS CMKs · SSM Parameter Store
                                                                    └─ Cognito (operator identity)   |   app-minted opaque tokens (supplier/reviewer)

   ECS Fargate: workers (one service per queue)
     malware-scan handler · OCR (Textract) · extraction (Bedrock) · export generation · notification delivery
   EventBridge Scheduler ─► reminders · staleness recompute · retention/deletion sweeps · catalog-overdue alerts

   Observability: ADOT → CloudWatch + X-Ray      Security: CloudTrail (org) · GuardDuty · Security Hub · AWS Config · Access Analyzer
```

## 3. Region and account topology

- **Primary region: `eu-west-1` (Ireland).** It supports SES **inbound** email (region-limited; `eu-west-1` confirmed), Textract, Bedrock, RDS/Aurora PostgreSQL, and every other core service, with EU residency in a single region.
- **Bedrock model availability is a `GATE`.** Confirm the required Claude model is available in `eu-west-1` before enabling `document_extraction`. If it is only in another EU region (e.g. `eu-central-1`), either run extraction there with a documented intra-EU data-flow review, or defer the feature.
- **AWS Organizations** with distinct accounts: `management`, `security` (log archive + GuardDuty/Security Hub delegated admin), `shared-services` (CI/CD, ECR, shared DNS), and one per environment: `dev`, `staging`, `prod`.
- **Service Control Policies** deny regions outside the approved EU set, deny disabling CloudTrail/GuardDuty/Config, and deny making S3 buckets public.
- **Later:** customer-dedicated account/region ("silo" tenancy) for enterprise or specific residency needs. Out of MVP; the per-environment account structure is designed so account-per-tenant is an extension, not a rewrite.

## 4. Service mapping

| Engine need (ENGINE_CONCEPT §4 / TRD) | AWS service | Notes and invariants |
| --- | --- | --- |
| Operator / supplier / reviewer web app | **S3 + CloudFront** (Origin Access Control), AWS WAF | Static React/TS bundle; SPA served from edge; portal routes get `no-store` + strict CSP + `Referrer-Policy: no-referrer` |
| API (modular monolith) | **ECS Fargate** service behind an internal **ALB**, fronted by CloudFront | ≥2 tasks across AZs; autoscale on CPU/RPS; rolling or CodeDeploy blue/green |
| Async workers | **ECS Fargate** service per **SQS** queue; **AWS Batch** on Fargate for heavy OCR spikes | Workers re-authorize tenant/object state; idempotent; scale on queue depth |
| Scheduled jobs | **EventBridge Scheduler** → SQS/Lambda | Reminders, staleness recompute, retention/deletion sweeps, catalog-update-overdue alerts |
| Domain events / outbox | Transactional outbox table → publisher → **EventBridge** (+ **SNS**→SQS fan-out) | Business state change and outbox row commit atomically |
| Relational data | **RDS for PostgreSQL**, Multi-AZ (upgrade path: **Aurora PostgreSQL**) | Private subnets; **row-level security** on; app role is RLS-enforced, migration role separate; PITR on |
| Object storage | **S3** buckets: `originals` (Object Lock, versioned), `derivatives`, `exports` (Object Lock for manifests), `quarantine` (isolated), `inbound-email` | SSE-KMS per-environment CMK; account-wide Block Public Access; access only via short-lived presigned URLs issued after authorization; S3 gateway VPC endpoint |
| Malware scanning | **GuardDuty Malware Protection for S3** on the quarantine bucket | Alternatives: ClamAV on Fargate, or a Marketplace scanner. Quarantined objects: distinct KMS key, IAM denies all app/worker roles, break-glass security role only |
| OCR / document parsing | **Amazon Textract** | Preserves page geometry for `EvidenceLocation` bounding boxes; runs in an isolated worker |
| Structured extraction (LLM) | **Amazon Bedrock** (Claude) behind the engine's `ExtractionAdapter` | Records provider/model id, region, prompt+schema version, input hashes, tokens/cost/latency (TRD §11.2). Not used for provider training by default — document for TR-SEC-011. Document text is untrusted; model has no tool access; retrieval limited to tenant+request scope |
| Operator identity | **Amazon Cognito** user pool (OIDC, TOTP MFA, email-OTP / WebAuthn passwordless) | Behind the replaceable `IdentityProvider` interface; Auth0 / WorkOS / self-hosted OIDC are drop-in alternatives |
| Supplier / reviewer principals | **App-minted opaque tokens** (not Cognito) | ≥128-bit entropy, stored only as a digest, bound to tenant + purpose + object/version + capability + expiry, revocable, WAF + app rate-limited, absent from logs/referrers |
| Outbound email | **Amazon SES** + configuration sets; events → EventBridge | Store delivery/bounce/complaint/suppression; no confidential values or attachments in bodies |
| Inbound email | **SES receipt rules** (`eu-west-1`) → S3 + SNS/Lambda | Per-request unpredictable addresses or signed routing tokens; verify SES/SNS signatures; ambiguous mail to a safe queue with no tenant context. `email_ingest` stays `PILOT/GATE` |
| Search | **PostgreSQL full-text** initially; OpenSearch only if needed | Tenant predicate on every query/index |
| Secrets / config | **Secrets Manager** (rotation) for credentials, provider keys, signing keys; **SSM Parameter Store** for non-secret config | No secrets in IaC or images |
| Observability | **ADOT** (AWS Distro for OpenTelemetry) sidecar → **CloudWatch** + **X-Ray** | OTel-compatible, vendor-swappable; correlation id, tenant pseudonym, actor type, opaque object id, result, latency — never tokens, evidence text, or claim values |
| Audit trail | Append-only table in PostgreSQL; **CloudTrail** org trail for infra actions → `security` account, S3 with Object Lock | Corrections are new events; tamper-evident digest is a later hardening step |
| Retention / deletion | **Step Functions** orchestration across RDS rows, S3 versions (incl. noncurrent + delete markers, respecting Object Lock), derivatives, search, SQS, provider artifacts | Completion evidence retained without deleted content (TRD §21.2) |
| Edge protection | **CloudFront** + **AWS WAF** (managed rule groups + rate-based rules on `/supplier/*`, `/review/*`) + **Shield Standard** | |
| CDN/API network isolation | **VPC** per environment, private subnets, NAT, **VPC endpoints** (S3, SQS, SNS, Secrets Manager, KMS, ECR, CloudWatch, Bedrock, Textract) | Keeps AWS traffic off the public internet; reduces NAT cost |

## 5. Ingestion and malware pipeline

Maps TRD §10.2 and the detailed-design document lifecycle (`UPLOADING → QUARANTINED → SCANNING → AVAILABLE → PARSING → PARSED`).

1. Client requests a short-lived presigned **multipart** PUT into the `quarantine` bucket (supports files to 250 MB, TRD §19).
2. S3 upload event → EventBridge → scan handler.
3. **GuardDuty Malware Protection for S3** scans the object; result tag applied.
4. Clean object is copied to `originals` with **Object Lock (governance mode)** and versioning; SHA-256 computed in a Fargate task before any derivative.
5. Derivatives (Textract text + coordinates, page images, redactions) generated in an isolated worker with egress only to AWS VPC endpoints.
6. Malicious/quarantined objects stay in `quarantine` with a separate CMK; all app and worker roles are explicitly denied; only a break-glass security role can retrieve them.

## 6. Identity and token model

- **Operators:** Cognito user pool; TOTP MFA required for `EO_ADMIN`, recommended for managers/approvers before launch (TR-SEC-002). Hosted or custom UI behind the `IdentityProvider` interface.
- **Suppliers and reviewers:** never Cognito. Opaque high-entropy tokens minted, hashed, and stored by the app; one tenant/purpose/object/capability/expiry each; immediate revocation; distinct principals from workspace users (engine primitive; TRD §15.3).
- **Services:** one IAM role per Fargate service, least privilege. No static access keys anywhere. GitHub Actions authenticates via **GitHub OIDC federation** into a deploy role.

## 7. Infrastructure as code and CI/CD

- **AWS CDK (TypeScript)** in `infra/`, matching the monorepo. Terraform is an acceptable alternative (ENGINE_CONCEPT §11 open decision).
- **GitHub Actions** (consistent with the other repositories) → assume-role via GitHub OIDC → build images to **ECR**, run database migrations as a gated step, `cdk deploy` per environment. Staging deploys automatically; production requires manual approval.
- Dependency, secret, and static analysis run in CI (Implementation Handoff §11.5); container images scanned in ECR.

## 8. Nonfunctional mapping (TRD §19)

| Target | How AWS meets it |
| --- | --- |
| Availability 99.5% monthly (interactive) | Multi-AZ RDS; ≥2 Fargate tasks per service across AZs; CloudFront |
| API p95 < 500 ms (ordinary reads/writes) | Right-sized Fargate; pooled DB connections (RDS Proxy if Lambda is introduced); indexed, tenant-scoped queries |
| Supplier page LCP < 2.5 s on mid-tier mobile/4G | S3 + CloudFront SPA, small bundle, edge-cached static assets |
| Resumable upload to 250 MB | S3 multipart presigned uploads |
| Extraction visible within 10 min at pilot scale | SQS + autoscaled Fargate workers + `JobStatus` surface |
| RPO ≤ 24 h / RTO ≤ 8 h | RDS PITR + Multi-AZ + cross-account snapshot copies to `security`; quarterly restore drill |
| Auditable actions durable before API success | Outbox/audit row commits in the same transaction as the business change |

## 9. Security and compliance controls (maps TRD §16)

- **KMS** CMKs per environment, rotation on; separate keys for the database, each S3 class, and secrets.
- **CloudTrail** organization trail → `security` account, immutable S3 (Object Lock). **GuardDuty**, **Security Hub** (CIS + AWS Foundational Security Best Practices), **AWS Config** conformance packs, **IAM Access Analyzer** for external-access findings.
- **VPC Flow Logs**, ALB logs, CloudFront logs, WAF logs → central logging.
- **CloudWatch alarms + EventBridge rules → SNS/on-call** for the TRD §20.3 signal list: cross-tenant authorization failures, suspicious token use, bulk downloads, scan/extraction queue age, export/deletion failures, backup/restore failures, source-catalog update overdue.
- **Deletion** (TRD §21.2) orchestrated by Step Functions; Object Lock retention windows are disclosed to customers as part of the deletion policy.

## 10. Cost anchors

Indicative only, `eu-west-1`, monthly, before document-processing volume. Not a budget — a sizing sketch to refine in FSG-001.

| Item | Rough monthly |
| --- | --- |
| 2× Fargate API tasks + worker tasks | $70–150 |
| RDS PostgreSQL Multi-AZ (small `r6g`/`m6g`) | $120–250 |
| NAT gateway (1–2 AZ) + data processing | $35–90 |
| CloudFront + WAF | $20–60 |
| S3 storage + KMS + requests (pilot volume) | $10–40 |
| SES outbound | ~$0.10 / 1,000 emails |
| Textract | ~$1.50 / 1,000 pages text; higher for forms/tables |
| Bedrock | per-token, workload-dependent |
| GuardDuty Malware Protection for S3 | ~$0.60 / GB scanned |
| **Baseline before processing volume** | **~$400–900 / month** |

## 11. Open AWS decisions

Feed these into [ENGINE_CONCEPT.md §11](ENGINE_CONCEPT.md).

| Decision | Default | Resolve by |
| --- | --- | --- |
| Bedrock Claude model + region for extraction | `eu-west-1` if available | Before enabling `document_extraction` (`GATE`) |
| API compute: ECS Fargate vs App Runner vs Lambda + API Gateway | ECS Fargate | Before engine skeleton |
| RDS PostgreSQL vs Aurora PostgreSQL | RDS PostgreSQL Multi-AZ | Revisit at scale / when clone-based restore tests or read replicas are needed |
| Malware scanning: GuardDuty Malware Protection for S3 vs ClamAV vs Marketplace | GuardDuty Malware Protection for S3 | Slice 4 (evidence intake) |
| KMS: per-environment CMK vs per-tenant CMK; customer-managed keys | Per-environment CMK | Before enterprise/silo tenancy |
| Selectable / customer-dedicated regions (silo tenancy) | Out of MVP; design account-per-tenant now | Enterprise discovery |
| IaC: AWS CDK vs Terraform | AWS CDK (TypeScript) | Before engine skeleton |
| Operator identity: Cognito vs external IdP (Auth0 / WorkOS) | Cognito | Security spike |

## 12. What does not change

The domain model, engine primitives, control-pack contract, readiness state machine, security requirements (`TR-SEC-*`), and acceptance criteria are cloud-neutral. AWS is an implementation of the boundaries defined in the Technical Requirements. Swapping any provider means new adapters behind existing interfaces — not a new domain model.
