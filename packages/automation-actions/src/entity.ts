// Helpers for reading the triggering entity out of an action's resolved fields.
//
// Executors act on the entity the automation fired for — the entity-resolver
// (docs/81 §5.3) has already hydrated it into dotted-path fields like
// `customer.id` / `deal.id`. A field the action requires but the trigger didn't
// carry is a configuration error: the action is wired to an entity its trigger
// can't supply (e.g. a customer tag on a deal-only event). We throw a clear
// message so the run records a `failed` step (loud), never a silent no-op.

import type { ResolvedFields } from '@sparx/automation';

/** Read a REQUIRED non-empty string field, throwing a clear config error if the
 *  trigger entity didn't resolve it. Used for ids AND for other required string
 *  fields like `customer.email` (an email executor wired to a customerless
 *  trigger is misconfigured — fail loud, never send to nobody). */
export function requireStringField(fields: ResolvedFields, key: string, action: string): string {
  const value = fields[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `${action}: required field '${key}' is missing from the trigger entity — ` +
        `this action needs a trigger that resolves '${key}'.`
    );
  }
  return value;
}

/** Required entity id — a thin, intent-revealing alias of requireStringField. */
export function requireEntityId(fields: ResolvedFields, key: string, action: string): string {
  return requireStringField(fields, key, action);
}

export function optionalEntityId(fields: ResolvedFields, key: string): string | undefined {
  const value = fields[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Read an optional boolean field (e.g. `customer.doNotContact`). Returns
 *  undefined when the trigger didn't resolve it. */
export function optionalBoolField(fields: ResolvedFields, key: string): boolean | undefined {
  const value = fields[key];
  return typeof value === 'boolean' ? value : undefined;
}
