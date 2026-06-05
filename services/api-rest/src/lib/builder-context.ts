// Bridge between Fastify auth context and @sparx/builder's ServiceContext.
//
// Every Builder service function takes `(ctx: ServiceContext, args)`. The REST
// transport wraps each handler with `requireBuilderModule(request)` (which also
// runs requireAuth) and `toBuilderContext(request)` to derive that ctx — keeping
// routes vanishingly thin (one service, many transports). Mirrors
// lib/sitebuilder-context.ts.

import type { FastifyRequest } from 'fastify';
import type { PropertyContext, ServiceContext } from '@sparx/builder';
import { isModuleEnabled } from '@sparx/auth';
import { requireAuth } from '@sparx/api-core/auth';
import { moduleDisabled } from '@sparx/api-core/errors';
import { resolvePropertyId } from './property.js';

// Tenant-wide builder ctx (NO property scope) — for the builder services that are
// NOT per-property: emails, the tenant component library, and the binding catalog
// (docs/49: those are shared across a tenant's sites). Sync — no property lookup.
export function toBuilderTenantContext(request: FastifyRequest): ServiceContext {
  const auth = requireAuth(request);
  return { tenantId: auth.tenantId, userId: auth.actorId };
}

// Async because Builder content is now per-PROPERTY (docs/49): the ctx carries
// the web property (site) being authored. The dashboard site switcher (Phase 3)
// sets `x-sparx-property-id` to choose which site; absent → the tenant's primary
// site, so single-site tenants are unaffected.
export async function toBuilderContext(request: FastifyRequest): Promise<PropertyContext> {
  const auth = requireAuth(request);
  const requested = request.headers['x-sparx-property-id'];
  const propertyId = await resolvePropertyId(
    auth.tenantId,
    typeof requested === 'string' ? requested : null
  );
  return { tenantId: auth.tenantId, userId: auth.actorId, propertyId };
}

/** Throws MODULE_DISABLED (→ 404 envelope) if the caller's tenant doesn't have
 *  the builder module active. Pairs with requireAuth — call once per handler
 *  before any service call. */
export async function requireBuilderModule(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  const enabled = await isModuleEnabled(auth.tenantId, 'builder');
  if (!enabled) throw moduleDisabled('builder');
}
