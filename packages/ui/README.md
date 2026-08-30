# @rre/ui

Accessible shared components and design tokens for the operator, contributor, and
reviewer apps.

Rules (engine detailed design 01 §8–§9, Handoff §13):

- readiness is text + icon + colour, never colour alone;
- components render every enum state exhaustively — an unknown state throws, it is
  not a silent default chip;
- no gamified completion, compliance score, or certification treatment.

Current: `ReadinessChip`. Component tests (jsdom + Testing Library) land with the
web app's test setup.
