// The runtime body validator moved to the neutral @sparx/field-schema engine
// (docs/143 §3). CMS consumers keep importing `bodyValidatorFor` / `validateBody`
// / `BodyValidationResult` from '@sparx/cms-schemas' — they resolve here to the
// shared engine unchanged. `ContentTypeSchema` (the CMS name) IS the neutral
// `FieldSchema`, so the validator accepts it directly.

export { bodyValidatorFor, validateBody } from '@sparx/field-schema';
export type { BodyValidationResult } from '@sparx/field-schema';
