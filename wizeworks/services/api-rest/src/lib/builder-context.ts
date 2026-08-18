// Bridge between Fastify auth context and @wizeworks/builder's ServiceContext.
//
// Every Builder service function takes `(ctx: ServiceContext, args)`. The REST
// transport wraps each handler with `requireBuilderModule(request)` (which also
// runs requireAuth) and `toBuilderContext(request)` to derive that ctx — keeping
// routes vanishingly thin (one service, many transports). Mirrors
// lib/sitebuilder-context.ts.

import type { FastifyRequest } from 'fastify';
import type { PropertyContext, ServiceContext, SiteChromeOptions } from '@wizeworks/builder';
import { isModuleEnabled } from '@wizeworks/auth';
import { requireAuth } from '@wizeworks/api-core/auth';
import { moduleDisabled } from '@wizeworks/api-core/errors';
import { resolvePropertyId, requireTenantProperty } from './property.js';

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
    auth,
    typeof requested === 'string' ? requested : null
  );
  return { tenantId: auth.tenantId, userId: auth.actorId, propertyId };
}

/**
 * Builder ctx for a read that may name a SPECIFIC site instead of the active one.
 *
 * Reads scoped to `x-sparx-property-id` assume you are looking at the site you
 * are working IN. That breaks for a site's own detail panel, which shows one
 * named site's figures while you may well be working in a different one — the
 * header would quietly serve the wrong site's numbers under that name.
 *
 * An explicit id therefore goes through `requireTenantProperty`, which 404s on
 * an unknown or foreign id rather than falling back to the primary. A silent
 * fallback is right for a HEADER (a stale switcher value should not break a
 * page); it is wrong for a value a caller named on purpose, because the failure
 * mode is showing real numbers attributed to the wrong site.
 */
export async function toBuilderContextFor(
  request: FastifyRequest,
  propertyParam: string | undefined
): Promise<PropertyContext> {
  if (!propertyParam) return toBuilderContext(request);
  const auth = requireAuth(request);
  const propertyId = await requireTenantProperty(auth, propertyParam);
  return { tenantId: auth.tenantId, userId: auth.actorId, propertyId };
}

/**
 * Which modules shape the starter chrome — the nav links a seeded or reset header
 * is allowed to carry.
 *
 * The three flags fail in DIFFERENT directions, and that asymmetry is the whole
 * reason this is one function rather than three inline `.catch(() => …)`s. Commerce
 * fails OPEN: a flag-lookup blip must never strip Shop from a tenant who pays for
 * it. Scheduling and CMS fail CLOSED: both are opt-in, so a blip must not invent a
 * Book or Journal link pointing at an index with nothing behind it.
 */
export async function siteChromeOptions(tenantId: string): Promise<SiteChromeOptions> {
  const [commerceEnabled, schedulingEnabled, cmsEnabled] = await Promise.all([
    isModuleEnabled(tenantId, 'commerce').catch(() => true),
    isModuleEnabled(tenantId, 'scheduling').catch(() => false),
    isModuleEnabled(tenantId, 'cms').catch(() => false),
  ]);
  return { commerceEnabled, schedulingEnabled, cmsEnabled };
}

/** Throws MODULE_DISABLED (→ 404 envelope) if the caller's tenant doesn't have
 *  the builder module active. Pairs with requireAuth — call once per handler
 *  before any service call. */
export async function requireBuilderModule(request: FastifyRequest): Promise<void> {
  const auth = requireAuth(request);
  const enabled = await isModuleEnabled(auth.tenantId, 'builder');
  if (!enabled) throw moduleDisabled('builder');
}
