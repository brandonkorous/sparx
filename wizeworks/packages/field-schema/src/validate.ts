// Build a Zod validator for a typed JSONB bag from a `FieldSchema`. Both
// domains that consume this engine call it the same way:
//
//   - api-rest validates a `content_entries.body` on every POST/PATCH to
//     /v1/content/entries (via @wizeworks/cms-schemas).
//   - the commerce product service validates a `commerce_products.attributes`
//     bag against its product type on write (via @wizeworks/commerce-schemas).
//
// Two key conventions:
//   - Unknown body keys are *stripped* (z.object().strip()), not rejected.
//     This keeps the API forgiving when a type drops a field and an old client
//     still sends it; the canonical bag shape is whatever the type schema says
//     today.
//   - References and assets are validated by SHAPE only (uuid string or array
//     thereof). Actually verifying the target row exists is the caller's job.

import { z } from 'zod';
import type { FieldSchema, FieldDef } from './types';

export function bodyValidatorFor(schema: FieldSchema): z.ZodObject {
  return buildObject(schema.fields);
}

function buildObject(fields: FieldDef[]): z.ZodObject {
  const shape: Record<string, z.ZodType> = {};
  for (const field of fields) {
    let validator = buildField(field);
    // A calculated field is never supplied — the server works it out on write
    // (./calc) — so `required` cannot apply to it: marking one required would
    // reject every write that correctly omitted it.
    if (!field.required || field.type === 'calculated') {
      validator = validator.optional().nullable();
    }
    shape[field.key] = validator;
  }
  // `.strip()` is the default in Zod 4 for z.object(); unknown keys are
  // discarded. We rely on it here — see header comment.
  return z.object(shape);
}

function buildField(field: FieldDef): z.ZodType {
  switch (field.type) {
    case 'text': {
      let s = z.string();
      if (field.min !== undefined) s = s.min(field.min);
      if (field.max !== undefined) s = s.max(field.max);
      if (field.pattern) s = s.regex(new RegExp(field.pattern));
      return s;
    }
    case 'long_text': {
      let s = z.string();
      if (field.min !== undefined) s = s.min(field.min);
      if (field.max !== undefined) s = s.max(field.max);
      return s;
    }
    case 'rich_text': {
      // Rich text is a TipTap-style document: { type: 'doc', content: [...] }
      // We do a structural sanity check here; deep block-shape validation
      // happens inside the editor on serialize.
      return z.object({
        type: z.string(),
        content: z.array(z.unknown()).optional(),
      });
    }
    case 'slug': {
      let s = z.string().regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);
      if (field.max !== undefined) s = s.max(field.max);
      return s;
    }
    case 'number': {
      let n = z.number();
      if (field.integer) n = n.int();
      if (field.min !== undefined) n = n.min(field.min);
      if (field.max !== undefined) n = n.max(field.max);
      return n;
    }
    case 'boolean':
      return z.boolean();
    case 'date':
      // ISO date (YYYY-MM-DD).
      return z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    case 'datetime':
      return z.string().datetime({ offset: true });
    case 'enum': {
      const values = field.options.map((o) => o.value);
      // z.enum requires at least one value; safe because schema validation
      // ensures options.min(1).
      const inner = z.enum(values as [string, ...string[]]);
      return field.multiple ? z.array(inner) : inner;
    }
    case 'url':
      return z.string().url();
    case 'email':
      return z.string().email();
    case 'reference': {
      const inner = z.string().uuid();
      return field.multiple ? z.array(inner) : inner;
    }
    case 'asset': {
      const inner = z.string().uuid();
      return field.multiple ? z.array(inner) : inner;
    }
    case 'currency': {
      let amount = z.number();
      if (field.min !== undefined) amount = amount.min(field.min);
      if (field.max !== undefined) amount = amount.max(field.max);
      return z.object({
        amount,
        // ISO 4217. Upper-cased by the caller before it gets here; a lowercase
        // code is a different string to every downstream formatter.
        currency: z.string().regex(/^[A-Z]{3}$/),
      });
    }
    case 'user': {
      const inner = z.string().uuid();
      return field.multiple ? z.array(inner) : inner;
    }
    case 'calculated':
      // Shape only. The value is recomputed and overwritten on every write, so
      // whatever arrives here is discarded — this just keeps a wrong-typed
      // submission from failing the parse before that happens.
      return field.resultType === 'currency'
        ? z.object({ amount: z.number(), currency: z.string().regex(/^[A-Z]{3}$/) })
        : z.number();
    case 'object':
      return buildObject(field.fields);
    case 'repeater': {
      let arr: z.ZodArray<z.ZodObject> = z.array(buildObject(field.fields));
      if (field.min !== undefined) arr = arr.min(field.min);
      if (field.max !== undefined) arr = arr.max(field.max);
      return arr;
    }
  }
}

// Convenience: validate a bag in one call, returning either the parsed value or
// a flattened error map (field path → message) suited to surfacing in a form.

export interface BodyValidationResult {
  ok: boolean;
  body?: Record<string, unknown>;
  errors?: Record<string, string>;
}

export function validateBody(schema: FieldSchema, input: unknown): BodyValidationResult {
  const result = bodyValidatorFor(schema).safeParse(input);
  if (result.success) {
    return { ok: true, body: result.data };
  }
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    errors[path || '_root'] = issue.message;
  }
  return { ok: false, errors };
}
