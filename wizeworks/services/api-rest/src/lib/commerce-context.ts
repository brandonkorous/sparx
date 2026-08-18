// Bridge between Fastify auth context and @wizeworks/commerce's ServiceContext.
//
// Mirrors crm-context.ts. Every Commerce service function takes
// `(ctx: ServiceContext, args)`; routes call `requireCommerceModule(request)`
// (which also runs requireAuth) and `toCommerceContext(request)` to derive
// that ctx — keeping the routes vanishingly thin per decision #7.

import type { FastifyRequest } from 'fastify';
import type { ServiceContext } from '@wizeworks/commerce';
import { isModuleEnabled } from '@wizeworks/auth';
import { requireAuth } from '@wizeworks/api-core/auth';
import { withRequestTenant } from '@wizeworks/api-core/db';
import { moduleDisabled } from '@wizeworks/api-core/errors';

import { defaultPropertyIdsToActiveSite, resolvePropertyId, type SiteActor } from './property.js';

export function toCommerceContext(request: FastifyRequest): ServiceContext {
  const auth = requireAuth(request);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

/** Throws MODULE_DISABLED (→ 404 envelope) if the caller's tenant doesn't
 *  have Commerce active. Pair with requireAuth — call it once per Commerce
 *  handler before any service call. */
export async function requireCommerceModule(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  const enabled = await isModuleEnabled(auth.tenantId, 'commerce');
  if (!enabled) throw moduleDisabled('commerce');
}

/** Model B (docs/49 §3): on a multi-site tenant, default a new catalog item's
 *  `body.propertyIds` to the ACTIVE site (from the `x-sparx-property-id` header,
 *  else the primary). The request plumbing for the pure `defaultPropertyIdsToActiveSite`
 *  helper, shared by the product / collection / category create routes. */
export async function defaultActiveSiteScope(
  request: FastifyRequest,
  actor: SiteActor,
  body: Record<string, unknown>
): Promise<void> {
  const header = request.headers['x-sparx-property-id'];
  const headerPropertyId = typeof header === 'string' ? header : null;
  await defaultPropertyIdsToActiveSite(
    body,
    () => withRequestTenant(request, (tx) => tx.property.count()),
    () => resolvePropertyId(actor, headerPropertyId)
  );
}
