// Resolve the {tenant, user, property} an SEO request is scoped to.
//
// SEO is not its own billable module (it covers Builder/CMS/Commerce pages), so
// there is no `requireSeoModule` — the SEO routes gate on role only, like the
// existing audit/report routes. What they DO need is the active web property:
// Search Console connections + organic rollups are per-(tenant, property), and
// the dashboard site switcher sets `x-sparx-property-id` (fail-closed to the
// tenant's primary). Mirrors toBuilderContext.

import type { FastifyRequest } from 'fastify';
import { requireAuth } from '@sparx/api-core/auth';

import { resolvePropertyId } from './property.js';

export interface SeoContext {
  tenantId: string;
  userId: string;
  propertyId: string;
}

export async function toSeoContext(request: FastifyRequest): Promise<SeoContext> {
  const auth = requireAuth(request);
  const requested = request.headers['x-sparx-property-id'];
  const propertyId = await resolvePropertyId(
    auth,
    typeof requested === 'string' ? requested : null
  );
  return { tenantId: auth.tenantId, userId: auth.actorId, propertyId };
}
