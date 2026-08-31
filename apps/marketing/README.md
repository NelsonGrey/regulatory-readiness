# Marketing site

Static Astro site for the public, pre-login Regulatory Readiness experience. The implementation follows [`docs/marketing/README.md`](../../docs/marketing/README.md).

## Run locally

```sh
pnpm install
pnpm dev:marketing
```

The default site is `http://localhost:4321`. Copy `.env.example` to `.env` and set the `PUBLIC_*` values to test real public destinations. Leaving analytics variables blank disables analytics.

## Content

- `src/content/packs/en/` — regulation-pack pages
- `src/content/posts/en/` — deadline briefings
- `src/content/legal/en/` — legal documents and visible launch placeholders
- `src/config.ts` — interim name, navigation, public destinations, and owner-supplied identity fields

Frontmatter is schema-checked during the Astro build. English content lives below locale-keyed directories so another locale can be added without moving existing entries.

## Verify

```sh
pnpm --filter @rre/marketing lint
pnpm --filter @rre/marketing lint:copy
pnpm --filter @rre/marketing build
pnpm --filter @rre/marketing preview --host 127.0.0.1
pnpm --filter @rre/marketing test:a11y
pnpm --filter @rre/marketing test:lighthouse
```

The copy guard imports the single forbidden-phrase list from `@rre/copy-guard`. Shared light/dark tokens come from `@rre/brand`, which is also consumed by the operator web app.

## Launch gates

The public name/domain, legal entity/address, binding legal text, scheduler, analytics provider, production AWS resources, and manual keyboard/screen-reader acceptance remain owner or deployment decisions. See [`docs/marketing/DEPLOYMENT.md`](../../docs/marketing/DEPLOYMENT.md).
