// The Marketplace catalog API (docs/60 §6) — one paginated + faceted + searchable
// contract per category, served generically from the DB through the uniform
// adapter + catalog service.
//
//   GET /v1/marketplace/:category         → faceted, paged catalog
//   GET /v1/marketplace/:category/:slug    → one listing (+ overlay)
//
// The contract is scale-ready: at today's catalog size the service filters/sorts
// the listings in memory; swapping to a Typesense-backed adapter (docs/60 Phase
// 6) is invisible to the dashboard because the response shape — { items, total,
// facets, next_cursor } — does not change.
//
// Per-tenant overlays are layered HERE, never in the (tenant-agnostic) catalog
// service: the `blueprints` category enriches each listing with this tenant's
// install state (read from tenant_blueprint_installs for the PRIMARY property,
// docs/54 D6) and exposes a synthetic `status` facet (installed / available).
// Install / go-live / reset stay in routes/v1/blueprints (docs/54 §8).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import type { TxClient } from '@wizeworks/db';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { notFound } from '@wizeworks/api-core/errors';
import { MarketplaceCategory, type MarketplaceListing } from '@wizeworks/marketplace-schemas';

import {
  marketplaceCatalogService,
  type ListOptions,
} from '../../../lib/marketplace/catalog-service.js';

const CategoryParam = z.object({ category: MarketplaceCategory });
const CategorySlugParam = z.object({
  category: MarketplaceCategory,
  slug: z.string().min(1).max(120),
});

// Overlay this tenant's blueprint install state onto the loaded listings. Runs
// inside the catalog read's tenant-scoped tx, so RLS already pins
// tenant_blueprint_installs to the caller; install state is read for the PRIMARY
// property (blueprints install there — docs/54 D6).
async function enrichBlueprintInstalls(
  tx: TxClient,
  listings: MarketplaceListing[]
): Promise<void> {
  const primary = await tx.property.findFirst({
    where: { isPrimary: true },
    select: { id: true },
  });
  if (!primary) return;
  const installs = await tx.tenantBlueprintInstall.findMany({
    where: { propertyId: primary.id },
    select: { id: true, blueprintKey: true, blueprintVersion: true, status: true },
  });
  const byKey = new Map(installs.map((i) => [i.blueprintKey, i]));
  for (const listing of listings) {
    const inst = byKey.get(listing.slug);
    listing.install = inst
      ? {
          id: inst.id,
          status: inst.status,
          version: inst.blueprintVersion,
          updateAvailable: inst.blueprintVersion !== listing.version,
        }
      : null;
  }
}

/** The per-tenant overlay options for a category, if any. Today only blueprints
 *  overlay install state; themes/components/integrations browse plain. */
function overlayOptions(category: string): ListOptions | undefined {
  if (category !== 'blueprints') return undefined;
  return {
    enrich: enrichBlueprintInstalls,
    extraFacets: [{ key: 'status', values: (l) => [l.install ? 'installed' : 'available'] }],
  };
}

const marketplaceRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/marketplace/:category', async (request) => {
    const auth = requireRole(request, 'viewer');
    const { category } = CategoryParam.parse(request.params);
    const result = await marketplaceCatalogService.list(
      category,
      request.query as Record<string, unknown>,
      { tenantId: auth.tenantId },
      overlayOptions(category)
    );
    return ok(result);
  });

  app.get('/v1/marketplace/:category/:slug', async (request) => {
    const auth = requireRole(request, 'viewer');
    const { category, slug } = CategorySlugParam.parse(request.params);
    const options = overlayOptions(category);
    const listing = await marketplaceCatalogService.get(
      category,
      slug,
      { tenantId: auth.tenantId },
      options ? { enrich: options.enrich } : undefined
    );
    if (!listing) throw notFound('Listing', `${category}/${slug}`);
    return ok(listing);
  });

  return Promise.resolve();
};

export default marketplaceRoutes;
