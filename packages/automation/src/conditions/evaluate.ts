// Condition evaluation — re-exported from `@sparx/automation-schemas`.
//
// The implementation MOVED there when `ConditionGroup` became the filter language
// of reports (docs/144 §8) and scoring (§10) as well as automations: the shape and
// its meaning have to travel together, or `contains` quietly comes to mean two
// different things in two packages. See the note at the top of
// `automation-schemas/src/evaluate.ts`.
//
// This file stays as the engine's import path — every call site inside the engine
// already reads `../conditions/evaluate`, and a re-export is cheaper and clearer
// than a sweep that would leave no trace of why the function lives elsewhere.

export { evaluateConditions } from '@sparx/automation-schemas';
