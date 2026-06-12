// Bridge between Fastify auth context and @sparx/sitebuilder's ServiceContext.
//
// Every Site Builder service function takes `(ctx: ServiceContext, args)`. The
// REST transport wraps each handler with `requireSitebuilderModule(request)`
// (which also runs requireAuth) and `toSitebuilderContext(request)` to derive
// that ctx — keeping routes vanishingly thin (one service, many transports).

import type { FastifyRequest } from 'fastify';
import type { PropertyContext, ServiceContext } from '@sparx/sitebuilder';
import { isModuleEnabled } from '@sparx/auth';
import { requireAuth } from '@sparx/api-core/auth';
import { moduleDisabled } from '@sparx/api-core/errors';
import { resolvePropertyId } from './property.js';

// Tenant-wide sitebuilder ctx (NO property scope) — for the services that are NOT
// per-property: the static theme catalog, the saved-theme LIBRARY CRUD, and the
// legacy section tier. Sync — no property lookup.
export function toSitebuilderContext(request: FastifyRequest): ServiceContext {
  const auth = requireAuth(request);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

// Async because the applied-theme lifecycle is now per-PROPERTY (docs/49 Phase 6):
// the ctx carries the web property (site) being authored. The dashboard site
// switcher sets `x-sparx-property-id`; absent → the tenant's primary site, so
// single-site tenants are unaffected. Mirrors lib/builder-context.ts.
export async function toSitebuilderPropertyContext(
  request: FastifyRequest
): Promise<PropertyContext> {
  const auth = requireAuth(request);
  const requested = request.headers['x-sparx-property-id'];
  const propertyId = await resolvePropertyId(
    auth.tenantId,
    typeof requested === 'string' ? requested : null
  );
  return { tenantId: auth.tenantId, userId: auth.actorId, propertyId };
}

/** Throws MODULE_DISABLED (→ 404 envelope) if the caller's tenant doesn't have
 *  the builder module active. (Legacy Site Builder shares the builder flag.)
 *  Pairs with requireAuth — call once per handler before any service call. */
export async function requireSitebuilderModule(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  const enabled = await isModuleEnabled(auth.tenantId, 'builder');
  if (!enabled) throw moduleDisabled('builder');
}
