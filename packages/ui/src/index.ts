/**
 * @rre/ui — accessible shared components and design tokens.
 *
 * Rules (engine detailed design 01 §8–§9, Handoff §13):
 *  - readiness is text + icon + colour, never colour alone;
 *  - components render every enum state exhaustively; an unknown state is an error;
 *  - no gamified completion, compliance score, or certification treatment.
 */
export { ReadinessChip } from './readiness-chip.js'
export type { ReadinessChipProps } from './readiness-chip.js'
export { ApplicabilityChip } from './applicability-chip.js'
export type { ApplicabilityChipProps } from './applicability-chip.js'
