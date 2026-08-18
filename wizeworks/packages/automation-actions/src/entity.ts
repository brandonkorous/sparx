// Helpers for reading the triggering entity out of an action's resolved fields.
//
// Executors act on the entity the automation fired for — the entity-resolver
// (docs/81 §5.3) has already hydrated it into dotted-path fields like
// `customer.id` / `deal.id`. A field the action requires but the trigger didn't
// carry is a configuration error: the action is wired to an entity its trigger
// can't supply (e.g. a customer tag on a deal-only event). We throw a clear
// message so the run records a `failed` step (loud), never a silent no-op.

import { interpolateEmailTokens } from '@wizeworks/builder-schemas';
import type { ResolvedFields, TenantCtx } from '@wizeworks/automation';

/** Interpolate `{{dotted.path}}` merge tokens in an authored string (a task title,
 *  a note body, an internal-alert subject) against the trigger's flat resolved
 *  fields, whose keys ARE the dotted paths. Shares the email merge grammar
 *  (`{{ path ?? "fallback" }}`) so a token reads identically everywhere. */
export function interpolateFields(input: string, fields: ResolvedFields): string {
  return input.includes('{{') ? interpolateEmailTokens(input, (path) => fields[path]) : input;
}

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

/** Read an optional non-empty string field. Returns undefined when the trigger
 *  didn't resolve it, or resolved it to an empty string — which for a subject
 *  line or a message body means the same thing as absent. */
export function optionalStringField(fields: ResolvedFields, key: string): string | undefined {
  const value = fields[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Optional entity id — an intent-revealing alias of the above, mirroring the
 *  required pair. */
export function optionalEntityId(fields: ResolvedFields, key: string): string | undefined {
  return optionalStringField(fields, key);
}

/** Read an optional boolean field (e.g. `customer.doNotContact`). Returns
 *  undefined when the trigger didn't resolve it. */
export function optionalBoolField(fields: ResolvedFields, key: string): boolean | undefined {
  const value = fields[key];
  return typeof value === 'boolean' ? value : undefined;
}

/** Render an unknown form-field value as a display string for the notify / answer
 *  lists: strings pass through, null/undefined → '', other primitives coerce, and
 *  objects/arrays JSON-encode — so a structured value never leaks the default
 *  '[object Object]' stringification. */
export function fieldValueToString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return JSON.stringify(value);
}

/** The tenant's default actor — the owner user, who system automations assign tasks
 *  to and notify when a seed names no explicit recipient (docs/90 §3b: the
 *  `create_task` assignee + the staff-alert `to` both fall back to the owner). A
 *  system automation has no acting user, so this is also the task CREATOR (the
 *  `created_by_id` NOT-NULL). Resolves the owner, then any staff user, then the
 *  tenant's contact email (userId null only if the tenant has no users at all).
 *  Reads through `ctx.tx`, so it's RLS-scoped to this tenant. */
export async function resolveTenantActor(
  ctx: TenantCtx
): Promise<{ userId: string | null; email: string | null }> {
  const owner = await ctx.tx.user.findFirst({
    where: { role: 'owner' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });
  if (owner) return { userId: owner.id, email: owner.email };
  const anyUser = await ctx.tx.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });
  if (anyUser) return { userId: anyUser.id, email: anyUser.email };
  const tenant = await ctx.tx.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { email: true },
  });
  return { userId: null, email: tenant?.email ?? null };
}
