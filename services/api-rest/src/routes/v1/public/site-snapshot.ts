// Public site read surface — the published Site Builder snapshot the
// public site (apps/site) renders.
//
//   GET /v1/public/site ?tenant=<slug> [&property=<slug>]
//     → { themeKey, appearancePolicy, compiledTokens: {light,dark},
//         sections: [...], layout: [...] } or null when nothing is published.
//
// Tenant is resolved from ?tenant=<slug> (the site hostname upstream).
// `?property=<slug>` selects which of the tenant's SITES to serve (docs/49
// Phase 6); omitted → the tenant's primary site, so single-site tenants are
// unchanged. The builder module must be enabled. Read-only and
// unauthenticated. Serves the PUBLISHED snapshot by default; with a valid
// site-preview token it serves the DRAFT composition so the dashboard's preview
// iframe shows unsaved work.
//
// `/v1/public/storefront/site` is the pre-rename alias (store→site), kept so
// in-flight clients keep working; remove once apps/site + any external callers
// are on `/v1/public/site`.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { isModuleEnabled } from '@sparx/auth';
import { publishService } from '@sparx/sitebuilder';
import { ok } from '@sparx/api-core/envelope';
import { moduleDisabled } from '@sparx/api-core/errors';
import { resolveTenantId } from '../../../lib/public-commerce-context.js';
import { resolvePublicPropertyId } from '../../../lib/property.js';
import { tryVerifySitePreview } from '../../../lib/preview.js';

const SiteQuery = z.object({ property: z.string().min(1).max(63).optional() });

const publicSiteSnapshotRoutes: FastifyPluginAsync = (app) => {
  const handler = async (request: FastifyRequest) => {
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
  };

  app.get('/v1/public/site', handler);
  // Deprecated pre-rename alias — remove after all callers move to /v1/public/site.
  app.get('/v1/public/storefront/site', handler);

  return Promise.resolve();
};

export default publicSiteSnapshotRoutes;
