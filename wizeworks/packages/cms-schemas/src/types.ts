// sparx CMS — content type schema format.
//
// The field vocabulary (the 15 field kinds, the whole-schema shape, and the
// recursive union schema) now lives in the neutral @wizeworks/field-schema package
// (docs/143 §3) so a single field engine backs both content types and product
// types. This module re-exports that vocabulary under the CMS-facing names —
// `ContentTypeSchema` is the CMS spelling of the neutral `FieldSchema` — so no
// CMS consumer changes: `import { ContentTypeSchema, FieldDef, bodyValidatorFor }
// from '@wizeworks/cms-schemas'` keeps resolving exactly as before.
//
// Convention (unchanged): a field's `key` is camelCase to match the body JSONB;
// the SQL column is snake_case for entries themselves (slug, status, …) but
// JSONB keys are not column names.

export type { FieldDef, ObjectFieldDef, RepeaterFieldDef } from '@wizeworks/field-schema';
export { FieldDefSchema } from '@wizeworks/field-schema';

// `ContentTypeSchema` is the CMS name for the neutral `FieldSchema` (value + type).
// A single re-export carries both the Zod value and the inferred type.
export { FieldSchema as ContentTypeSchema } from '@wizeworks/field-schema';

import type { FieldSchema } from '@wizeworks/field-schema';

// ContentTypeDefinition is the in-memory shape of a built-in or custom content
// type. Mirrors the columns of `content_types` so the migration that seeds
// built-ins can read it directly. This stays CMS-specific — it is not part of
// the neutral field engine.
export interface ContentTypeDefinition {
  key: string;
  name: string;
  pluralName: string;
  description?: string;
  urlPattern?: string;
  icon?: string;
  isSingleton?: boolean;
  schema: FieldSchema;
}
