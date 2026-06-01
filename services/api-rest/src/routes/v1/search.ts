// Search routes. Thin transport over @sparx/search's tenant-scoped query
// wrappers (Typesense). Every query is forced to the caller's tenant by the
// wrapper — routes never touch the raw client. The dashboard list pages,
// ⌘K palette, and staff reindex/status tooling all consume these.
//
// Products are commerce-gated; customers/orders are crm-gated; the ⌘K
// palette spans all three so it only requires auth. Reindex is admin-only
// and runs in the commerce-indexer worker via a published event.

import crypto from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  collectionStats,
  generateScopedSearchKeyWithExpiry,
  palette,
  searchAll,
  searchCustomers,
  searchOrders,
  searchProducts,
} from '@sparx/search';
import { listEnabledModules } from '@sparx/auth';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireAuth, requireRole } from '@sparx/api-core/auth';
import { publish } from '@sparx/api-core/pubsub';

import { requireCommerceModule } from '../../lib/commerce-context.js';
import { requireCrmModule } from '../../lib/crm-context.js';

const SearchProductsQuery = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(250).optional(),
  filter_by: z.string().optional(),
  facet_by: z.string().optional(),
  sort_by: z.string().optional(),
  // Fitment filters accept comma-separated values; the wrapper composes
  // them into Typesense filter grammar so callers don't learn it.
  fitment_makes: z.string().optional(),
  fitment_models: z.string().optional(),
  fitment_engines: z.string().optional(),
  fitment_year: z.coerce.number().int().optional(),
});

const SearchQuery = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(250).optional(),
});

const PaletteQuery = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

const SearchAllQuery = z.object({
  q: z.string().optional(),
  /** Comma-separated module filter; intersected with the tenant's enabled set. */
  modules: z.string().optional(),
  /** Comma-separated entity_type filter (e.g. a single list page). */
  types: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(250).optional(),
});

const ReindexBody = z
  .object({
    collections: z.array(z.enum(['products', 'customers', 'orders'])).optional(),
    drop_stale: z.boolean().optional(),
  })
  .optional();

function csv(value?: string): string[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

const searchRoutes: FastifyPluginAsync = (app) => {
  // ── Products (commerce-gated) ──────────────────────────────────────
  app.get('/v1/search/products', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const auth = requireAuth(request);
    const q = SearchProductsQuery.parse(request.query);
    const result = await searchProducts({
      tenantId: auth.tenantId,
      q: q.q,
      page: q.page,
      perPage: q.per_page,
      filterBy: q.filter_by,
      facetBy: q.facet_by,
      sortBy: q.sort_by,
      fitmentMakes: csv(q.fitment_makes),
      fitmentModels: csv(q.fitment_models),
      fitmentEngines: csv(q.fitment_engines),
      fitmentYear: q.fitment_year,
    });
    return paged(
      result.hits.map((h) => h.document),
      { total: result.found, per_page: result.perPage, page: result.page }
    );
  });

  // ── Customers (crm-gated) ──────────────────────────────────────────
  app.get('/v1/search/customers', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const auth = requireAuth(request);
    const q = SearchQuery.parse(request.query);
    const result = await searchCustomers({
      tenantId: auth.tenantId,
      q: q.q ?? '*',
      page: q.page,
      perPage: q.per_page,
    });
    return paged(
      result.hits.map((h) => h.document),
      { total: result.found, per_page: result.perPage, page: result.page }
    );
  });

  // ── Orders (crm-gated) ─────────────────────────────────────────────
  app.get('/v1/search/orders', async (request) => {
    requireRole(request, 'viewer');
    await requireCrmModule(request);
    const auth = requireAuth(request);
    const q = SearchQuery.parse(request.query);
    const result = await searchOrders({
      tenantId: auth.tenantId,
      q: q.q ?? '*',
      page: q.page,
      perPage: q.per_page,
    });
    return paged(
      result.hits.map((h) => h.document),
      { total: result.found, per_page: result.perPage, page: result.page }
    );
  });

  // ── Multi-collection palette (⌘K). Auth-only; each sub-search is
  //    still tenant-filtered. Disabled-module collections simply return
  //    no docs (their collection is empty), so no per-module gate here. ──
  app.get('/v1/search', async (request) => {
    requireRole(request, 'viewer');
    const auth = requireAuth(request);
    const q = PaletteQuery.parse(request.query);
    const result = await palette({
      tenantId: auth.tenantId,
      q: q.q,
      limitPerCollection: q.limit,
    });
    return ok({
      products: result.products.map((h) => h.document),
      customers: result.customers.map((h) => h.document),
      orders: result.orders.map((h) => h.document),
    });
  });

  // ── Index status — per-collection tenant-scoped doc counts. ────────
  app.get('/v1/search/status', async (request) => {
    requireRole(request, 'viewer');
    const auth = requireAuth(request);
    const collections = await collectionStats(auth.tenantId);
    return ok({ collections });
  });

  // ── Universal search (docs/39) — the `entities` collection spanning every
  //    module. Auth-only; results are gated to the tenant's ENABLED modules so
  //    a disabled module's stale docs never surface. `types` narrows to one or
  //    more entity types (a single list page); facet counts ride in meta. ──
  app.get('/v1/search/all', async (request) => {
    requireRole(request, 'viewer');
    const auth = requireAuth(request);
    const q = SearchAllQuery.parse(request.query);
    const enabled = await listEnabledModules(auth.tenantId);
    const enabledSet = enabled as readonly string[];
    const requested = csv(q.modules);
    // Intersect any requested modules with the enabled set; default to all
    // enabled modules so disabled-module hits are never returned.
    const modules = requested ? requested.filter((m) => enabledSet.includes(m)) : [...enabledSet];
    const result = await searchAll({
      tenantId: auth.tenantId,
      q: q.q,
      modules,
      entityTypes: csv(q.types),
      page: q.page,
      perPage: q.per_page,
    });
    return paged(
      result.hits.map((h) => h.document),
      {
        total: result.found,
        per_page: result.perPage,
        page: result.page,
        facets: result.facetCounts,
      }
    );
  });

  // ── Scoped search key — a short-TTL Typesense key locked to this tenant
  //    via an embedded filter, so the storefront/dashboard CAN query
  //    Typesense directly from the browser (instant-search) without
  //    proxying every keystroke. Server-proxied search stays the default;
  //    this is opt-in. Requires TYPESENSE_SEARCH_KEY (a search-only parent
  //    key) — returns 501 if the platform hasn't provisioned one. ──
  app.get('/v1/search/key', async (request, reply) => {
    requireRole(request, 'viewer');
    const auth = requireAuth(request);
    try {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const scoped = generateScopedSearchKeyWithExpiry(auth.tenantId, nowSeconds);
      return ok({
        key: scoped.key,
        expiresInSeconds: scoped.expiresInSeconds,
        host: process.env.TYPESENSE_HOST ?? 'typesense',
        port: Number(process.env.TYPESENSE_PORT ?? 8108),
        protocol: process.env.TYPESENSE_PROTOCOL ?? 'http',
      });
    } catch {
      // No search-only parent key provisioned — feature unavailable, not an
      // error in the caller's request.
      reply.code(501);
      return {
        success: false as const,
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Direct-search keys are not enabled for this deployment.',
          request_id: request.id,
        },
      };
    }
  });

  // ── Reindex — admin-only. Publishes an event the commerce-indexer
  //    consumes; the worker rebuilds the tenant's collections from
  //    Postgres. Returns 202 + a runId for log correlation. ──
  app.post('/v1/search/reindex', async (request, reply) => {
    const auth = requireRole(request, 'admin');
    const body = ReindexBody.parse(request.body) ?? {};
    const runId = `reindex_${crypto.randomUUID().replace(/-/g, '')}`;
    await publish(request.log, 'search.reindex.requested', auth.tenantId, auth.actorId, {
      runId,
      collections: body.collections,
      dropStale: body.drop_stale ?? false,
    });
    reply.code(202);
    return ok({ runId, accepted: true });
  });

  return Promise.resolve();
};

export default searchRoutes;
