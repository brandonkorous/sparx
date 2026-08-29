// Search routes. Thin transport over @wizeworks/search's tenant-scoped query
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
import { withTenant } from '@wizeworks/db';
import {
  collectionStats,
  findableProductCount,
  generateScopedSearchKeyWithExpiry,
  palette,
  resolveTypesenseHost,
  resolveTypesensePort,
  resolveTypesenseProtocol,
  searchAll,
  searchCustomers,
  searchOrders,
  searchProducts,
} from '@wizeworks/search';
import { listEnabledModules } from '@wizeworks/auth';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireAuth, requireRole } from '@wizeworks/api-core/auth';
import { publish } from '@wizeworks/api-core/pubsub';

import { requireCommerceModule } from '../../lib/commerce-context.js';
import { requireCrmModule } from '../../lib/crm-context.js';
import { resolveListScope } from '../../lib/property.js';

/** How long a product is allowed to be out of the index before its absence counts
 *  as lost rather than in flight. Generous on purpose: the cost of waiting five
 *  minutes to tell somebody is nothing, and the cost of a warning that appears and
 *  clears on every save is that she stops reading them. */
const INDEX_GRACE_MS = 5 * 60 * 1000;

const SearchProductsQuery = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  per_page: z.coerce.number().int().min(1).max(250).optional(),
  filter_by: z.string().optional(),
  facet_by: z.string().optional(),
  sort_by: z.string().optional(),
  // Model B (docs/49 §3): scope the back-office product search to one site
  // (the dashboard catalog's Site filter). Omitted → the whole catalog.
  // Omitted → the caller's active site; `all` → every site.
  property: z.string().min(1).optional(),
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
  // Active site (docs/58) — scope customer/order search to one web property
  // (the dashboard list Site filter). Omitted → the whole tenant ("All sites").
  // Omitted → the caller's active site; `all` → every site.
  property: z.string().min(1).optional(),
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
    const propertyId = await resolveListScope(
      auth,
      q.property,
      request.headers['x-sparx-property-id']
    );
    const result = await searchProducts({
      tenantId: auth.tenantId,
      propertyId,
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
    const propertyId = await resolveListScope(
      auth,
      q.property,
      request.headers['x-sparx-property-id']
    );
    const result = await searchCustomers({
      tenantId: auth.tenantId,
      q: q.q ?? '*',
      propertyId,
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
      propertyId: q.property,
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

  // ── Index status — per-collection tenant-scoped doc counts, plus the one
  //    number a count on its own cannot give: how many products are ON SALE
  //    and NOT FINDABLE. ──
  //
  // Why the second number has to be computed HERE. Indexing rides on events, so
  // a product written while the indexer was down — or one that predates a fixed
  // subscription (issue 281) — never enters the index and never will on its own.
  // Its owner types its name and the box answers "nothing matches", definitively,
  // about something she sells. A doc count cannot see that: twelve documents look
  // exactly like sixteen until you know there should be sixteen. This route is the
  // only place that can hold the catalog and the index at the same time.
  //
  // SETTLED ROWS ONLY, and that is what keeps it from crying wolf. The indexer is
  // asynchronous, so a product saved seconds ago is legitimately not in there yet;
  // counting it would produce a warning that clears itself and teaches people to
  // ignore the one that does not. Anything changed inside the grace window is left
  // out of the comparison entirely.
  app.get('/v1/search/status', async (request) => {
    requireRole(request, 'viewer');
    const auth = requireAuth(request);
    const settledBefore = new Date(Date.now() - INDEX_GRACE_MS);
    const [collections, findable, onSale] = await Promise.all([
      collectionStats(auth.tenantId),
      findableProductCount(auth.tenantId),
      withTenant({ tenantId: auth.tenantId }, (tx) =>
        tx.product.count({
          where: { status: 'active', deletedAt: null, updatedAt: { lte: settledBefore } },
        })
      ),
    ]);
    // `null` is "the collection is not there, so we could not look" — never zero,
    // and never a gap of everything. A caller that renders a warning from this
    // must treat null as silence.
    const productsMissing = findable === null ? null : Math.max(0, onSale - findable);
    return ok({ collections, productsMissing });
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
        host: resolveTypesenseHost(),
        port: resolveTypesensePort(),
        protocol: resolveTypesenseProtocol(),
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
