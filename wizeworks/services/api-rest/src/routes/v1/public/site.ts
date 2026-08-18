// Public host→site resolution (docs/49 §5) — the storefront (wizeworks/apps/site) maps an
// incoming Host header to { tenantSlug, propertySlug } here, then passes both to
// the public content/builder reads (`?tenant=&property=`). Covers connected
// custom domains and `*.sparx.zone` subdomains in one call.
//
//   GET /v1/public/site-by-host  ?host=<hostname>
//     → { tenantSlug, propertySlug } for a routable host, else 404
//
// No auth (`/v1/public/` is auth-exempt). Reads the non-RLS `domains`/`tenants`
// tables + a tenant-scoped property read inside the shared resolver.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@wizeworks/api-core/envelope';
import { notFound } from '@wizeworks/api-core/errors';
import { resolveSiteByHost } from '../../../lib/domain.js';

const HostQuery = z.object({ host: z.string().min(1).max(255) });

const publicSiteRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/public/site-by-host', async (request) => {
    const { host } = HostQuery.parse(request.query);
    const route = await resolveSiteByHost(host);
    if (!route) throw notFound('Site', host);
    // Slugs only — the storefront fetches the rest by slug. Ids stay server-side.
    return ok({ tenantSlug: route.tenantSlug, propertySlug: route.propertySlug });
  });

  return Promise.resolve();
};

export default publicSiteRoutes;
