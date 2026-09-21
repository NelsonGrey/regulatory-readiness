# Security Policy

## Supported Versions

This project is in a pre-release "proposed/discovery" stage. Only the code currently on each environment branch is supported — there is no long-term support for older commits.

| Branch | Environment | Status |
|---|---|---|
| `main` | Production | Supported |
| `staging` | Staging | Supported |
| `develop` | Development | Supported |

## Reporting a Vulnerability

This repository doesn't have a public issue tracker, so please don't report security concerns that way. Use one of:

- GitHub's [private vulnerability reporting](https://github.com/NelsonGrey/regulatory-readiness/security/advisories/new) (enabled on this repo), or
- Email **support@nelsongrey.com**

Either way, include:

- A description of the vulnerability and its potential impact
- Steps to reproduce, or a proof of concept if available
- Any relevant logs, request/response samples, or affected endpoints

You should get an acknowledgement within a few business days.

## Automated Dependency Scanning

Dependabot alerts and security updates, and native GitHub secret scanning (with push protection) are enabled on this repository. Code scanning (CodeQL) is not yet configured here. Avoid committing credentials or secrets regardless — this project doesn't yet have a centralized secrets manager wired up, so keep runtime secrets in local environment variables or your deployment platform's secret store, never in version control.
