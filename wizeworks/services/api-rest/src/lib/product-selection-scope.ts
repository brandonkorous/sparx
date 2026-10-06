// "Every product that matches" means every product THIS LIST would show.
//
// The Products list is scoped to the site the caller is working in (the
// `x-sparx-property-id` header, else primary). A bulk write that takes the list's
// narrowing must be scoped the same way, or "All 126 matching" chosen on one
// site's list would also reach products only another site sells. So the route
// sets `match.propertyId` from the same resolution the list read uses, and
// overwrites whatever the body said: the console never names it, and a body
// naming another site is exactly the case this exists to stop.

import type { FastifyRequest } from 'fastify';

import { resolveListScope, type SiteActor } from './property.js';

/** Returns the body with `selection.match.propertyId` set to the caller's list
 *  scope. An ids selection is returned untouched: ids name products exactly. */
export async function scopeProductSelection(
  request: FastifyRequest,
  actor: SiteActor,
  body: unknown
): Promise<unknown> {
  if (typeof body !== 'object' || body === null) return body;
  const selection = (body as { selection?: unknown }).selection;
  if (typeof selection !== 'object' || selection === null || !('match' in selection)) return body;
  const match = (selection as { match?: unknown }).match;
  if (typeof match !== 'object' || match === null) return body;

  const propertyId = await resolveListScope(
    actor,
    undefined,
    request.headers['x-sparx-property-id']
  );
  const rest: Record<string, unknown> = { ...(match as Record<string, unknown>) };
  delete rest.propertyId;
  return {
    ...(body as Record<string, unknown>),
    selection: { match: propertyId ? { ...rest, propertyId } : rest },
  };
}
