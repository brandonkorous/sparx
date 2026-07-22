// Public universal search for storefronts (docs/39 §9).
//
//   GET /v1/public/search ?tenant=<slug>&q=<query>[&page=&perPage=]
//
// "Search everything" on the tenant's public website — products, collections,
// and CMS pages in one typo-tolerant query against the universal `entities`
// collection. Hard-gated to PUBLIC-safe entity types + published/active status,
// so internal entities (orders, customers, discounts, b2b accounts, quotes, …)
// are never reachable here even though they share the collection. No auth;
// tenant by slug (identical to the other /v1/public/* surfaces).
//
// The universal doc's `url` is the ADMIN deep-link (dashboard editor), so we
// hydrate handle/slug from the owning table and build the STOREFRONT path —
// mirroring how the public product search hydrates display rows from Postgres.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { ok } from '@sparx/api-core/envelope';
import { withTenant } from '@sparx/db';
import { searchAll } from '@sparx/search';
import { requireTenantIdBySlug } from '../../../lib/tenant-slug.js';

// Only entity types with a public storefront page. Categories are an admin
// organizational concept (no storefront route) and stay out.
const PUBLIC_ENTITY_TYPES = ['product', 'collection', 'cms_page'];
// Products are 'active', CMS pages are 'published', collections are 'active'.
const PUBLIC_STATUSES = ['active', 'published'];

const SearchQuery = z.object({
  tenant: z.string().min(1).max(63),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(20),
});

// Cached in lib/tenant-slug.ts (docs/127 §5).
const resolveTenantBySlug = requireTenantIdBySlug;

interface Hit {
  entity_type: string;
  record_id: string;
}

// Build the storefront-facing path for each hit by hydrating handle/slug from
// the owning table. Re-checks publish/active state so a doc that went stale
// between index and read is dropped rather than linked to a dead page.
async function publicUrlsFor(tenantId: string, hits: Hit[]): Promise<Map<string, string>> {
  const idsOf = (type: string) =>
    hits.filter((h) => h.entity_type === type).map((h) => h.record_id);
  const urls = new Map<string, string>();

  await withTenant({ tenantId }, async (tx) => {
    const productIds = idsOf('product');
    if (productIds.length > 0) {
      const rows = await tx.product.findMany({
        where: { id: { in: productIds }, status: 'active', deletedAt: null },
        select: { id: true, handle: true },
      });
      for (const r of rows) urls.set(`product:${r.id}`, `/products/${r.handle}`);
    }

    const collectionIds = idsOf('collection');
    if (collectionIds.length > 0) {
      const rows = await tx.productCollection.findMany({
        where: { id: { in: collectionIds }, deletedAt: null },
        select: { id: true, handle: true },
      });
      for (const r of rows) urls.set(`collection:${r.id}`, `/collections/${r.handle}`);
    }

    const pageIds = idsOf('cms_page');
    if (pageIds.length > 0) {
      const rows = await tx.page.findMany({
        where: { id: { in: pageIds }, status: 'published' },
        select: { id: true, slug: true },
      });
      for (const r of rows) urls.set(`cms_page:${r.id}`, `/${r.slug}`);
    }
  });

  return urls;
}

const publicSearchRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/public/search', async (request) => {
    const q = SearchQuery.parse(request.query);
    const tenantId = await resolveTenantBySlug(q.tenant);

    const result = await searchAll({
      tenantId,
      q: q.q,
      entityTypes: PUBLIC_ENTITY_TYPES,
      statuses: PUBLIC_STATUSES,
      page: q.page,
      perPage: q.perPage,
    });

    const docs = result.hits.map((h) => h.document);
    const urls = await publicUrlsFor(
      tenantId,
      docs.map((d) => ({ entity_type: d.entity_type, record_id: d.record_id }))
    );

    // Preserve Typesense relevance order; drop any hit whose row vanished.
    const results = docs.flatMap((d) => {
      const url = urls.get(`${d.entity_type}:${d.record_id}`);
      if (!url) return [];
      return [{ type: d.entity_type, title: d.title, subtitle: d.subtitle ?? null, url }];
    });

    return ok({ results, total: result.found });
  });

  return Promise.resolve();
};

export default publicSearchRoutes;
