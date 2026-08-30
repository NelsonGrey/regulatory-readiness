/**
 * @rre/control-catalog — pack loader, compiler, and validator. Pack-agnostic:
 * the only regulation-specific input is the data bundle under `packs/<pack-key>/`.
 *
 * See ENGINE_CONCEPT §5 (artifact contract), ADR 0005, engine Handoff §5.
 */
export * from './pack.js'
export * from './applicability.js'
