# Marketing deployment runbook

The marketing site builds to static files in `apps/marketing/dist`. Production infrastructure is intentionally not asserted by the repository until the AWS stack is provisioned and verified.

## Required decisions

- Clear the product name and canonical domain.
- Supply the legal entity, registered address, and approved legal text.
- Confirm the monthly plan prices shown on `/pricing` (`apps/marketing/src/config.ts`, `plans`).
- Select and review the cookieless analytics provider.
- Complete manual keyboard and screen-reader acceptance on the key routes.

## GitHub environment configuration

Create `staging` and `production` environments. Set `MARKETING_DEPLOY_ENABLED=true` only after their AWS resources exist.

Variables: `PUBLIC_SITE_URL`, `PUBLIC_APP_URL` (the self-serve app; "Start free" links to `${PUBLIC_APP_URL}/sign-up`), optional `PUBLIC_ANALYTICS_DOMAIN`, optional `PUBLIC_ANALYTICS_SRC`, `MARKETING_BUCKET`, and `CLOUDFRONT_DIST_ID`.

Secret: `AWS_ROLE_ARN`, an OIDC-assumable role restricted to the environment bucket and distribution.

## Release flow

1. Merge to `staging`; the marketing workflow validates copy, types, static output, accessibility, and Lighthouse budgets.
2. Verify canonical URLs, the "Start free" / "Sign in" links resolve to the app, zero cookies on initial load, metadata, and the manual accessibility checklist on the staging domain.
3. Promote the same reviewed change to `main`.
4. Confirm the CloudFront invalidation completes and smoke-test `/`, `/how-it-works`, `/packs/eu-accessibility-act`, `/pricing`, and `/contact`.
5. If the release is bad, redeploy the last known-good commit through the same workflow. Do not edit the bucket by hand.

The workflow applies one-year immutable caching to hashed `_astro` assets and five-minute revalidation to site documents.
