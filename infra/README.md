# infra

Infrastructure as code (AWS CDK, TypeScript) per [ADR 0001](../docs/adr/0001-cloud-platform-aws.md) and [ARCHITECTURE_AWS.md](../docs/ARCHITECTURE_AWS.md).

**Status:** stub. No CDK app yet. Provision AWS foundations only when integration testing needs them (see [DEVELOPMENT.md](../docs/DEVELOPMENT.md)); local development runs entirely on Docker Compose.

## Contents

| Path | Purpose |
| --- | --- |
| `localstack/init/` | Scripts LocalStack runs on startup to create local S3 buckets and SQS queues |

## Planned

- `bin/` + `lib/` — CDK app: Organizations accounts, VPC, RDS, S3 (Object Lock), SQS/EventBridge, Cognito, SES, CloudFront/WAF, ECR, GitHub OIDC deploy role.
- One stack per concern; environments as CDK context (`dev`, `staging`, `prod`).
- No secrets in this folder.
