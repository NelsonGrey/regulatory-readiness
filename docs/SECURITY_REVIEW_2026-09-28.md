# Security review — 2026-09-28

## Executive summary

The review found one high-severity authentication fail-open, one medium-severity vulnerable development dependency, and one medium-severity deployment control that is specified in architecture documents but not enforced by the repository. The authentication and Vitest findings are remediated on the associated cleanup branch. No committed private keys or common provider-token patterns were found. GitHub secret scanning and push protection are enabled; GitHub code scanning has no analysis configured.

This is a source and repository-configuration review, not a penetration test or production-deployment attestation.

## High severity

### SEC-001 — Production startup silently trusts an unauthenticated identity header

- **Remediation status:** fixed on `security-quality-cleanup`; production now requires complete OIDC settings and explicit development header authentication is rejected when `NODE_ENV=production`.

- **Rule ID:** AUTH-FAIL-CLOSED-001
- **Location:** `apps/api/src/index.ts:129-144`; `apps/api/src/auth/verifier.ts:13-16`; `apps/api/src/app.ts:135-138`
- **Evidence:** when either `AUTH_JWT_ISSUER` or `AUTH_JWKS_URI` is absent, `main()` selects `headerVerifier()`. That verifier accepts the caller-controlled `x-user-email` header. This fallback is independent of `DEV_AUTH`; `buildApp()` also defaults to the same header verifier when no verifier is supplied.
- **Impact:** a remote caller who knows or guesses the email address of a workspace member can impersonate that member. Membership checks still constrain the selected workspace, but they do not authenticate the claimed identity.
- **Fix:** fail startup unless both OIDC settings are present. Permit `headerVerifier()` only behind an explicit development mode that is also rejected when `NODE_ENV=production`. Make `buildApp()` require an explicit verifier outside tests instead of choosing a permissive default.
- **Mitigation:** until fixed, do not expose the API beyond a trusted local environment and ensure every deployed environment supplies the expected issuer and JWKS URI.
- **False-positive notes:** an upstream gateway could overwrite and authenticate the header, but no such binding or trusted-proxy enforcement is visible in this repository. The current comments explicitly describe the header verifier as a development stand-in.

## Medium severity

### SEC-002 — Vitest dependency permits arbitrary file reads from an exposed development server

- **Remediation status:** fixed on `security-quality-cleanup` with Vitest 4.1.11 and the supported `test.projects` configuration.

- **Rule ID:** REACT-SUPPLY-001
- **Location:** `package.json` (`vitest`); `pnpm-lock.yaml`; GitHub Dependabot alerts 1-3
- **Evidence:** the repository resolves Vitest 2.1.x. GitHub reports `GHSA-82fw-gwwq-j7x9` / `CVE-2026-84373` for both `vitest` and `@vitest/mocker`; the first patched release is 4.1.11.
- **Impact:** an attacker who can reach an affected mocker development server may read files available to that process. The advisory concerns development/test infrastructure rather than the production application bundle.
- **Fix:** migrate to Vitest 4.1.11 or later and update the DOM test setup for Vitest 4. PR #1 attempts the dependency update but currently fails CI because browser tests no longer receive the expected document/DOM globals.
- **Mitigation:** keep development/test servers bound to localhost and do not expose them to untrusted networks while the migration is pending.
- **False-positive notes:** the vulnerable packages are development dependencies and the exploit requires a reachable affected development-server path, which lowers production exposure but does not remove workstation/CI risk.

### SEC-003 — Browser security headers are planned but not enforced in repository deployment code

- **Rule ID:** REACT-HEADERS-001 / REACT-CSP-001
- **Location:** `docs/ARCHITECTURE_AWS.md:58`; `.github/workflows/marketing.yml:63-72`
- **Evidence:** the architecture calls for a strict CSP, `Referrer-Policy`, and portal `no-store`, but the deployment workflow only synchronizes S3 objects and invalidates CloudFront. No checked-in CloudFront response-header policy or equivalent runtime-header configuration is present.
- **Impact:** if the deployed edge is not configured separately, the React/marketing shells may lack clickjacking, MIME-sniffing, referrer, permissions, and CSP defenses.
- **Fix:** define and attach a version-controlled CloudFront response-headers policy (or document and test the external policy), then add an automated deployed-header check before release.
- **Mitigation:** verify the live distribution headers manually before exposing any portal or user-controlled content.
- **False-positive notes:** the headers may be configured outside this repository. This finding remains unverified until a deployed endpoint or external infrastructure configuration is inspected.

## Repository quality and governance observations

- `develop` is the default branch but has no branch protection or ruleset visible through the GitHub API. CI can therefore be bypassed by a direct push.
- `.github/workflows/ci.yml` now runs lint, copy guard, typecheck, tests, build, `pnpm format:check`, and a high-severity production dependency audit with a frozen lockfile.
- Secret scanning and push protection are enabled. Code scanning has no analysis configured.
- PR #2 is limited to `README.md`, is mergeable, and has a passing `verify` check. Its claimed demo flow should still be reviewed for product accuracy before merge.

## Recommended order

1. Make production authentication fail closed and add regression tests.
2. Repair and complete the Vitest 4.1.11 migration so Dependabot alerts 1-3 close.
3. Add CI formatting and dependency-security gates with explicit permissions and timeouts.
4. Protect `develop` with required checks and stale-review dismissal; disable direct pushes except for an explicit administrator policy.
5. Verify or codify deployed security headers.
