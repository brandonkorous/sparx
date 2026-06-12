// Public storefront read surface — the published Site Builder snapshot the
// storefront renders.
//
//   GET /v1/public/storefront/site ?tenant=<slug> [&property=<slug>]
//     → { themeKey, appearancePolicy, compiledTokens: {light,dark},
//         sections: [...], layout: [...] } or null when nothing is published.
//
// Tenant is resolved from ?tenant=<slug> (the storefront hostname upstream).
// `?property=<slug>` selects which of the tenant's SITES to serve (docs/49
// Phase 6); omitted → the tenant's primary site, so single-site tenants are
// unchanged. The storefront module must be enabled. Read-only and
// unauthenticated. Serves the PUBLISHED snapshot by default; with a valid
// site-preview token it serves the DRAFT composition so the dashboard's preview
// iframe shows unsaved work.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { isModuleEnabled } from '@sparx/auth';
import { publishService } from '@sparx/sitebuilder';
import { ok } from '@sparx/api-core/envelope';
import { moduleDisabled } from '@sparx/api-core/errors';
import { resolveTenantId } from '../../../lib/public-commerce-context.js';
import { resolvePublicPropertyId } from '../../../lib/property.js';
import { tryVerifySitePreview } from '../../../lib/preview.js';

const SiteQuery = z.object({ property: z.string().min(1).max(63).optional() });

const publicStorefrontRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/public/storefront/site', async (request) => {
    const tenantId = await resolveTenantId(request);
    if (!(await isModuleEnabled(tenantId, 'builder'))) throw moduleDisabled('builder');
    const { property } = SiteQuery.parse(request.query);
    const propertyId = await resolvePublicPropertyId(tenantId, property ?? null);
    const ctx = { tenantId, propertyId };
    // With a valid `Authorization: Preview <site-preview jwt>` (minted by the
    // dashboard for its own tenant) serve the DRAFT composition; otherwise the
    // published snapshot. An invalid/expired token throws — it is NOT silently
    // downgraded to published (that masking was the original "doesn't apply" bug).
    const preview = tryVerifySitePreview(app, request, tenantId);
    const snapshot = preview
      ? await publishService.getDraftSnapshot(ctx)
      : await publishService.getPublishedSnapshot(ctx);
    return ok(snapshot);
  });

  return Promise.resolve();
};

export default publicStorefrontRoutes;
