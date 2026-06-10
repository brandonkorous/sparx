// The Marketplace catalog API (docs/60). One paginated + faceted + searchable
// contract per category; this file implements the **blueprints** category.
//
//   GET /v1/marketplace/blueprints            → faceted, paged catalog
//   GET /v1/marketplace/blueprints/:key       → one item (detail + install state)
//
// The contract is scale-ready (docs/60 §6): at today's catalog size the adapter
// filters/sorts the in-memory blueprint registry; swapping to a Typesense-backed
// list (docs/60 phase 2) is invisible to the dashboard because the response shape
// — { items, total, facets, next_cursor } — does not change. Per-tenant install
// state is overlaid here, never part of the (tenant-agnostic) catalog.
//
// Read-only browse is viewer-gated; install/go-live/reset stay in
// routes/v1/blueprints (docs/54 §8).

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { withTenant } from '@sparx/db';
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { notFound } from '@sparx/api-core/errors';
import { getBlueprint, listBlueprints, toSummary, type Blueprint } from '@sparx/blueprints';
import { MarketplaceCategory } from '@sparx/marketplace-schemas';

import { resolvePrimaryPropertyId } from '../../../lib/property.js';
import { marketplaceCatalogService } from '../../../lib/marketplace/catalog-service.js';

const KeyParam = z.object({ key: z.string().min(1).max(63) });
const CategoryParam = z.object({ category: MarketplaceCategory });
const CategorySlugParam = z.object({
  category: MarketplaceCategory,
  slug: z.string().min(1).max(120),
});

const BrowseQuery = z.object({
  q: z.string().trim().max(120).optional(),
  // Facets are AND across keys, OR within a key — values are comma-separated.
  vertical: z.string().max(200).optional(),
  modules: z.string().max(200).optional(),
  status: z.enum(['installed', 'available']).optional(),
  sort: z.enum(['popular', 'name', 'newest']).default('popular'),
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

/** Comma-separated facet param → a set of non-empty values. */
function parseFacet(v: string | undefined): Set<string> {
  return new Set(
    (v ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/** "What this creates" breakdown for the browse/detail card (mirrors the
 *  blueprints route — the catalog item shape stays identical). */
function summarizeContents(bp: Blueprint) {
  const c = bp.commerce;
  return {
    products: c?.products.length ?? 0,
    categories: c?.categories.length ?? 0,
    collections: c?.collections.length ?? 0,
    content: bp.content.length,
    pages: bp.pages.length,
    emails: bp.emails.length,
    components: bp.components.length,
    theme: bp.theme.name,
    hasLayout: Boolean(bp.layout),
  };
}

interface InstallRow {
  id: string;
  blueprintKey: string;
  blueprintVersion: string;
  status: string;
}

/** The per-tenant install overlay: install state always reads the PRIMARY
 *  property (docs/54 D6), so the catalog is tenant-level. */
async function loadInstalls(tenantId: string): Promise<Map<string, InstallRow>> {
  const propertyId = await resolvePrimaryPropertyId(tenantId);
  const installs = await withTenant({ tenantId }, (tx) =>
    tx.tenantBlueprintInstall.findMany({
      where: { propertyId },
      select: { id: true, blueprintKey: true, blueprintVersion: true, status: true },
    })
  );
  return new Map(installs.map((i) => [i.blueprintKey, i]));
}

function installState(bp: Blueprint, inst: InstallRow | undefined) {
  if (!inst) return null;
  return {
    id: inst.id,
    status: inst.status,
    version: inst.blueprintVersion,
    update_available: inst.blueprintVersion !== bp.version,
  };
}

function catalogItem(bp: Blueprint, inst: InstallRow | undefined) {
  return { ...toSummary(bp), contents: summarizeContents(bp), install: installState(bp, inst) };
}

/** Count occurrences of a value across a list → a { value: count } record. */
function tally(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}

const marketplaceRoutes: FastifyPluginAsync = (app) => {
  app.get('/v1/marketplace/blueprints', async (request) => {
    const auth = requireRole(request, 'viewer');
    const query = BrowseQuery.parse(request.query);
    const installs = await loadInstalls(auth.tenantId);

    const verticals = parseFacet(query.vertical);
    const modules = parseFacet(query.modules);
    const q = query.q?.toLowerCase();

    // 1. Free-text narrowing (name / summary / vertical). Facet COUNTS are computed
    //    over this q-narrowed set so the rail reflects the current search.
    const searched = listBlueprints().filter((bp) => {
      if (!q) return true;
      return (
        bp.name.toLowerCase().includes(q) ||
        bp.summary.toLowerCase().includes(q) ||
        bp.vertical.toLowerCase().includes(q)
      );
    });

    // 2. Facet selections — AND across facets, OR within each. `skip` lets the
    //    facet-count pass below exclude a facet's OWN selection (standard faceted
    //    search: a facet's counts reflect the OTHER active filters, not itself).
    const matches = (bp: Blueprint, skip?: 'vertical' | 'modules' | 'status') => {
      if (skip !== 'vertical' && verticals.size > 0 && !verticals.has(bp.vertical)) return false;
      if (skip !== 'modules' && modules.size > 0 && !bp.requiresModules.some((m) => modules.has(m)))
        return false;
      if (skip !== 'status' && query.status) {
        const isInstalled = installs.has(bp.key);
        if (query.status === 'installed' && !isInstalled) return false;
        if (query.status === 'available' && isInstalled) return false;
      }
      return true;
    };
    const matched = searched.filter((bp) => matches(bp));

    // 3. Sort. `newest` has no authored timestamp yet → registry order reversed as
    //    a stable proxy until the catalog is data-backed (docs/60 §12).
    const sorted = [...matched];
    if (query.sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (query.sort === 'newest') sorted.reverse();

    // 4. Page.
    const total = sorted.length;
    const page = sorted.slice(query.cursor, query.cursor + query.limit);
    const nextOffset = query.cursor + query.limit;
    const next_cursor = nextOffset < total ? String(nextOffset) : null;

    // 5. Facet counts — each computed over the q-narrowed set with the OTHER facets
    //    applied but its own selection excluded, so selecting one value doesn't zero
    //    out its siblings (proper faceted search).
    const forStatus = searched.filter((bp) => matches(bp, 'status'));
    const facets = {
      vertical: tally(searched.filter((bp) => matches(bp, 'vertical')).map((bp) => bp.vertical)),
      modules: tally(
        searched.filter((bp) => matches(bp, 'modules')).flatMap((bp) => bp.requiresModules)
      ),
      status: {
        installed: forStatus.filter((bp) => installs.has(bp.key)).length,
        available: forStatus.filter((bp) => !installs.has(bp.key)).length,
      },
    };

    return ok({
      items: page.map((bp) => catalogItem(bp, installs.get(bp.key))),
      total,
      facets,
      next_cursor,
    });
  });

  app.get('/v1/marketplace/blueprints/:key', async (request) => {
    const auth = requireRole(request, 'viewer');
    const { key } = KeyParam.parse(request.params);
    const bp = getBlueprint(key);
    if (!bp) throw notFound('Blueprint', key);
    const installs = await loadInstalls(auth.tenantId);
    return ok(catalogItem(bp, installs.get(bp.key)));
  });

  // ─── Generic, data-backed catalog (docs/60 §6) ─────────────────────────────
  //
  // The DB-backed browse/detail for every category, served through the uniform
  // adapter + catalog service. The `blueprints` category keeps the bespoke,
  // registry-backed handlers above (with the per-tenant install overlay) — a
  // Fastify static route wins over `:category`, so these handle themes /
  // components / integrations today. Phase 2 folds blueprints onto this generic
  // path (adding the install overlay here) and retires the bespoke handlers.
  //
  // Tenant-scoped read: a tenant additionally sees its OWN draft listings
  // (docs/60 §6.3) once publishing exists; published+public is all that shows
  // today.
  app.get('/v1/marketplace/:category', async (request) => {
    const auth = requireRole(request, 'viewer');
    const { category } = CategoryParam.parse(request.params);
    const result = await marketplaceCatalogService.list(
      category,
      request.query as Record<string, unknown>,
      { tenantId: auth.tenantId }
    );
    return ok(result);
  });

  app.get('/v1/marketplace/:category/:slug', async (request) => {
    const auth = requireRole(request, 'viewer');
    const { category, slug } = CategorySlugParam.parse(request.params);
    const listing = await marketplaceCatalogService.get(category, slug, {
      tenantId: auth.tenantId,
    });
    if (!listing) throw notFound('Listing', `${category}/${slug}`);
    return ok(listing);
  });

  return Promise.resolve();
};

export default marketplaceRoutes;
