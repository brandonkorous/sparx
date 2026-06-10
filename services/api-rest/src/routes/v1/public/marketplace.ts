// The PUBLIC marketplace catalog API (docs/60 §6, D7) — the unauthenticated,
// no-tenant surface apps/web's public marketplace (Phase 5) consumes.
//
//   GET /v1/public/marketplace/:category        → faceted, paged catalog
//   GET /v1/public/marketplace/:category/:slug   → one listing
//
// Same uniform contract as the authed dashboard route, but with NO tenant
// context: the catalog service runs the read under `withSystem`, so the
// `marketplace_visibility` RLS policy shows only published rows (a tenant's own
// drafts are invisible without its tenant id). Public per the `/v1/public/`
// prefix's auth skip (app.ts) — no Bearer required.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { ok } from '@sparx/api-core/envelope';
import { notFound } from '@sparx/api-core/errors';
import { MarketplaceCategory } from '@sparx/marketplace-schemas';

import { marketplaceCatalogService } from '../../../lib/marketplace/catalog-service.js';

const CategoryParam = z.object({ category: MarketplaceCategory });
const CategorySlugParam = z.object({
  category: MarketplaceCategory,
  slug: z.string().min(1).max(120),
});

const publicMarketplaceRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/public/marketplace/:category', async (request) => {
    const { category } = CategoryParam.parse(request.params);
    const result = await marketplaceCatalogService.list(
      category,
      request.query as Record<string, unknown>,
      {}
    );
    return ok(result);
  });

  app.get('/v1/public/marketplace/:category/:slug', async (request) => {
    const { category, slug } = CategorySlugParam.parse(request.params);
    const listing = await marketplaceCatalogService.get(category, slug, {});
    if (!listing) throw notFound('Listing', `${category}/${slug}`);
    return ok(listing);
  });

  return Promise.resolve();
};

export default publicMarketplaceRoutes;
