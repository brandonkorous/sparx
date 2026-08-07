// CRM object definitions — the write shapes for the object registry (docs/144 §3).
//
// An object definition says what a CRM record IS: its name, and the extra
// properties this business tracks on it. For the four BUILT-IN objects the
// schema holds only the tenant's ADDITIONS — the fixed spine (a contact's email,
// a deal's value) stays in indexed columns. For a tenant-invented object it
// holds the whole record.
//
// The field vocabulary itself is NOT redefined here: it is the neutral
// `FieldSchema` from @sparx/field-schema, the same engine behind CMS content
// types and commerce product types. This module re-exports it under the
// CRM-facing name `PropertySchema` so CRM code reads in CRM words, exactly as
// cms-schemas re-exports it as `ContentTypeSchema`.

import { z } from 'zod';
import { FieldSchema, type FieldDef } from '@sparx/field-schema';

import { Uuid } from './common';

export type { FieldDef } from '@sparx/field-schema';
export { FieldDefSchema, bodyValidatorFor, validateBody } from '@sparx/field-schema';

/** The CRM's name for the neutral `FieldSchema` (value + inferred type). */
export { FieldSchema as PropertySchema } from '@sparx/field-schema';

/**
 * The four objects sparx ships. Each has a fixed spine in its own table and can
 * carry tenant-declared properties on top.
 *
 * `company` — not `b2b_account`. The table is still `b2b_accounts` until
 * docs/144 §11 renames it, but the object a business owner is describing is a
 * company, and the vocabulary should not have to change under them later.
 */
export const BUILTIN_OBJECT_KEYS = ['contact', 'company', 'deal', 'ticket'] as const;
export type BuiltinObjectKey = (typeof BUILTIN_OBJECT_KEYS)[number];

export const ObjectKind = z.enum(['builtin', 'custom']);
export type ObjectKind = z.infer<typeof ObjectKind>;

/**
 * A custom object's key. snake_case, must start with a letter, and may not
 * collide with a built-in — a tenant naming their object `deal` would make
 * every "which table does this live in?" question ambiguous forever.
 */
export const CustomObjectKey = z
  .string()
  .min(2)
  .max(63)
  .regex(
    /^[a-z][a-z0-9_]*$/,
    'Use lowercase letters, numbers and underscores, starting with a letter.'
  )
  .refine((key) => !BUILTIN_OBJECT_KEYS.includes(key as BuiltinObjectKey), {
    message: 'That name is already used by one of the built-in records.',
  });

export const ObjectDefKey = z.string().min(2).max(63);

/* ── Create / update ────────────────────────────────────────────────────── */

// A tenant can only CREATE custom objects. The four built-in rows are seeded by
// CRM module activation, so there is no shape here that can mint one — which is
// what keeps `kind` honest without trusting a client to send it.
export const CreateObjectDefInput = z.object({
  key: CustomObjectKey,
  label: z.string().min(1).max(120),
  labelPlural: z.string().min(1).max(120),
  iconKey: z.string().max(63).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  propertySchema: FieldSchema.optional(),
  /** Which property titles the record. Must name a field in the schema. */
  primaryFieldKey: z.string().max(63).nullable().optional(),
});
export type CreateObjectDefInput = z.infer<typeof CreateObjectDefInput>;

// `key` and `kind` are absent on purpose: the key is the FK target for every
// record of the object, so renaming it would orphan them, and the kind decides
// where the values physically live.
export const UpdateObjectDefInput = z.object({
  label: z.string().min(1).max(120).optional(),
  labelPlural: z.string().min(1).max(120).optional(),
  iconKey: z.string().max(63).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  propertySchema: FieldSchema.optional(),
  primaryFieldKey: z.string().max(63).nullable().optional(),
});
export type UpdateObjectDefInput = z.infer<typeof UpdateObjectDefInput>;

export const ListObjectDefsInput = z.object({
  kind: ObjectKind.optional(),
  includeArchived: z.boolean().optional(),
});
export type ListObjectDefsInput = z.infer<typeof ListObjectDefsInput>;

/* ── Records of a custom object ─────────────────────────────────────────── */

export const CreateCrmRecordInput = z.object({
  objectKey: ObjectDefKey,
  propertyId: Uuid.nullable().optional(),
  ownerId: Uuid.nullable().optional(),
  /** Validated against the object's own schema by the service, not here. */
  values: z.record(z.string(), z.unknown()).default({}),
});
export type CreateCrmRecordInput = z.infer<typeof CreateCrmRecordInput>;

export const UpdateCrmRecordInput = z.object({
  propertyId: Uuid.nullable().optional(),
  ownerId: Uuid.nullable().optional(),
  values: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateCrmRecordInput = z.infer<typeof UpdateCrmRecordInput>;

export const ListCrmRecordsInput = z.object({
  objectKey: ObjectDefKey,
  q: z.string().trim().min(1).max(200).optional(),
  ownerId: Uuid.optional(),
  propertyIds: z.array(Uuid).optional(),
  take: z.number().int().min(1).max(250).optional(),
  skip: z.number().int().min(0).optional(),
});
export type ListCrmRecordsInput = z.infer<typeof ListCrmRecordsInput>;

/* ── Schema integrity ───────────────────────────────────────────────────── */

/**
 * The checks a `FieldSchema` needs that the field engine cannot make on its own,
 * because they are about the schema as a WHOLE rather than any one field.
 *
 * Returns a list of human-readable problems — empty means fine. Worded for a
 * business owner, not a developer: they are shown verbatim in the property
 * editor.
 */
export function checkPropertySchema(
  schema: { fields: FieldDef[] },
  options: { primaryFieldKey?: string | null } = {}
): string[] {
  const problems: string[] = [];

  // Duplicate keys silently overwrite each other in the JSONB bag, so one of
  // the two fields would appear to save and then vanish.
  const seen = new Set<string>();
  for (const field of schema.fields) {
    if (seen.has(field.key)) {
      problems.push(`More than one field is called "${field.key}". Each needs its own name.`);
    }
    seen.add(field.key);
  }

  // A calculated field naming a field that does not exist resolves to zero at
  // run time — a confidently wrong number, the worst kind of wrong.
  const keys = [...seen];
  for (const field of schema.fields) {
    if (field.type !== 'calculated') continue;
    for (const mentioned of mentionedKeys(field.expression)) {
      if (!keys.includes(mentioned) && !CALC_FUNCTIONS.has(mentioned)) {
        problems.push(
          `"${field.label}" works itself out from "${mentioned}", which is not a field on this record.`
        );
      }
    }
  }

  const primary = options.primaryFieldKey;
  if (primary && !seen.has(primary)) {
    problems.push(`The field used as the title, "${primary}", is not on this record.`);
  }

  return problems;
}

const CALC_FUNCTIONS = new Set(['round', 'abs', 'min', 'max']);

/** Every bare identifier in a calculated expression. */
function mentionedKeys(expression: string): string[] {
  const found = new Set<string>();
  for (const match of expression.matchAll(/[a-zA-Z_][a-zA-Z0-9_]*/g)) {
    found.add(match[0]);
  }
  return [...found];
}
