// The one write path for tenant-declared properties (docs/144 §3).
//
// Every CRM object that carries a `custom_properties` bag — contact, company,
// deal, and (Phase 4) ticket — validates it the same way, and a custom object's
// whole `values` bag goes through the identical code. One function, so a rule
// like "calculated fields are always recomputed server-side" cannot hold on
// contacts and quietly not hold on deals.
//
// THREE THINGS HAPPEN HERE, IN THIS ORDER, AND THE ORDER MATTERS:
//
//   1. VALIDATE against the object's schema. Unknown keys are stripped, not
//      rejected — the field engine's convention (wizeworks/packages/field-schema
//      validate.ts): a client still sending a field the business removed last
//      week should not have its whole save fail.
//   2. RECOMPUTE every calculated field. After validation, so the arithmetic
//      runs on clean numbers; and unconditionally, so a value a client invented
//      is discarded rather than stored.
//   3. MERGE onto what is already there, because a PATCH that sends one property
//      means "change this one", not "delete the other nine".
//
// An object with no declared properties short-circuits: no schema to read, no
// validator to build, nothing to merge. That is the common case on day one and
// it must not cost a query.

import { applyCalculatedFields, validateBody, type FieldSchema } from '@wizeworks/field-schema';
import type { Prisma } from '@wizeworks/db';

import { CrmValidationError } from '../errors';

/** The bag as it is stored: a plain JSON object, never null. */
export type PropertyBag = Record<string, unknown>;

/** Read a stored `property_schema` / bag column into a usable shape. */
export function asPropertySchema(raw: unknown): FieldSchema {
  if (raw && typeof raw === 'object' && 'fields' in raw && Array.isArray(raw.fields)) {
    return raw as FieldSchema;
  }
  return { fields: [] };
}

export function asBag(raw: unknown): PropertyBag {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as PropertyBag) : {};
}

export interface ResolveOptions {
  /** The object's declared schema. `{fields:[]}` means nothing to do. */
  schema: FieldSchema;
  /** What is stored on the record today. Empty on a create. */
  existing?: unknown;
  /** What the caller sent. `undefined` means "don't touch the bag at all". */
  incoming: unknown;
  /**
   * Where errors are reported from, so a message reads
   * `customProperties.warrantyExpires` rather than a bare field key.
   */
  fieldPrefix?: string;
}

/**
 * Validate + recompute + merge, or throw a `CrmValidationError` naming the
 * fields that are wrong.
 *
 * Returns `undefined` when there is nothing to write, which callers spread into
 * a Prisma `data` object so an untouched bag stays untouched.
 */
export function resolvePropertyBag(options: ResolveOptions): PropertyBag | undefined {
  const { schema, incoming, existing, fieldPrefix = 'customProperties' } = options;

  // Nothing sent → nothing written. Distinct from `{}`, which means "clear it".
  if (incoming === undefined) return undefined;

  const merged: PropertyBag = { ...asBag(existing), ...asBag(incoming) };

  // No declared properties. Anything sent has no schema to be valid against, so
  // storing it would be storing untyped junk under a typed column's name.
  if (schema.fields.length === 0) return {};

  const result = validateBody(schema, merged);
  if (!result.ok) {
    throw new CrmValidationError(
      'Some of the extra details are not valid.',
      Object.entries(result.errors ?? {}).map(([path, message]) => ({
        field: path === '_root' ? fieldPrefix : `${fieldPrefix}.${path}`,
        message,
      }))
    );
  }

  // Step 2 — always, and always AFTER validation. A calculated field is the
  // server's arithmetic; whatever arrived under that key is now gone.
  return applyCalculatedFields(schema, result.body ?? {});
}

/**
 * Which declared properties actually changed between two bags.
 *
 * Drives the `crm.property.changed` event, which is what the automation engine's
 * property-changed trigger keys off (docs/144 §9). Compared by serialized value
 * so a nested object or a repeater is judged on content rather than identity.
 */
export function changedProperties(before: unknown, after: unknown): string[] {
  const a = asBag(before);
  const b = asBag(after);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(a[key] ?? null) !== JSON.stringify(b[key] ?? null)) changed.push(key);
  }
  return changed;
}

/**
 * The bag as a Prisma-writable value.
 *
 * Prisma types a `Json` column as `InputJsonValue`, which a plain
 * `Record<string, unknown>` does not satisfy — an unknown could be `undefined`,
 * which is not JSON. The bag has already been through the validator by the time
 * this is called, so the assertion is narrowing a type we have proved rather
 * than asserting one we hope for.
 */
export function toJsonInput(bag: PropertyBag): Prisma.InputJsonValue {
  return bag as Prisma.InputJsonValue;
}
