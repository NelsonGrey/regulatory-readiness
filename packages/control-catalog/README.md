# @rre/control-catalog

Pack loader, compiler, and validator. **Pack-agnostic** — the engine has no
`if (pack === …)` branches; the only regulation-specific input is the data bundle
in `packs/<pack-key>/`.

## API

| Export | Purpose |
| --- | --- |
| `loadPack(dir)` | Read + Zod-validate `manifest.json`, `controls.json`, `entity-facts.schema.json`, `applicability/rules.json`, `test-vectors.json`, `copy/strings.json`; compute the content checksum. Throws `PackLoadError` on cross-file `packKey` mismatch. |
| `validatePack(loaded)` | Structural + known-outcome checks: declared vs actual control count, unique keys, applicability rules reference known controls/families, checksum (warning for `draft`, error for `active`), two-person review gate for `active`, and every `test-vectors.applicability` vector reproduces its expected results. |
| `loadInstalledPacks(root)` | Discover and validate every pack directory under `root`. |
| `evaluateExpression(expr, facts, opts)` | Pure evaluation of one applicability expression → `true \| false \| 'unknown'`. |
| `evaluateApplicability(ruleSet, controls, facts, opts)` | Per-control applicability result. First matching rule wins; `unknown` → `CONDITIONAL_FACT_REQUIRED`; no match → `defaultResult`. |

Validation contract: engine TRD §7.1, §22.4; ADR 0005. Evaluation semantics: engine TRD §7.3.
