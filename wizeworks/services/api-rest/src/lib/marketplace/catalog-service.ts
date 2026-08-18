// The marketplace catalog service (docs/60 §6) — generic browse + detail over
// any category, blind to the underlying table. It loads the category's
// RLS-visible listings via the adapter, then does the faceted-search algebra
// (free-text narrow → facet filter → sort → page, with facet counts computed
// over the q-narrowed set excluding each facet's own selection) entirely on the
// normalized MarketplaceListing. At today's catalog size this in-memory pass is
// trivial; the response shape ({ items, total, facets, next_cursor }) is
// identical to a future Typesense-backed adapter (Phase 6), so swapping is
// invisible to callers.
//
// Per-tenant OVERLAYS (a blueprint's install state) are NOT applied here — the
// catalog is tenant-agnostic. The route layers those on top (docs/60 §6).

import { withSystem, withTenant, type TxClient } from '@wizeworks/db';
import {
  MarketplaceBrowseQuery,
  type MarketplaceCategory,
  type MarketplaceFacetBucket,
  type MarketplaceListing,
  type MarketplaceListResponse,
  type MarketplaceSort,
} from '@wizeworks/marketplace-schemas';

import { ADAPTERS, type FacetDef } from './adapters.js';

/** Browse context. With a tenantId the read runs under that tenant (so a future
 *  "my drafts" overlay sees them); without, it's the public no-tenant path. */
export interface CatalogContext {
  tenantId?: string;
}

/** Optional per-request hooks the catalog service stays agnostic about (docs/60
 *  §6). `enrich` runs inside the read tx after the listings load and may mutate
 *  them (e.g. set each blueprint's per-tenant `install` state); `extraFacets`
 *  are merged with the adapter's so a synthetic dimension (e.g. install
 *  `status`) participates in filtering + counts like any other. */
export interface ListOptions {
  enrich?: (tx: TxClient, listings: MarketplaceListing[]) => Promise<void>;
  extraFacets?: FacetDef[];
}

function run<T>(ctx: CatalogContext, fn: (tx: TxClient) => Promise<T>): Promise<T> {
  return ctx.tenantId ? withTenant({ tenantId: ctx.tenantId }, fn) : withSystem(fn);
}

// ── Public browse cache ─────────────────────────────────────────────────────
//
// The public (no-tenant, no-enrich) browse set is IDENTICAL for every caller — it
// is the published catalog, nothing per-request. Without a cache each request
// re-reads the category and re-materializes every row into a fresh listing object,
// so N concurrent requests hold N copies of the whole catalog live at once. Under a
// burst of distinct-but-equivalent facet queries that is what exhausted api-rest's
// V8 heap on 2026-07-16 (the browse ALGEBRA is cheap and already runs outside the
// transaction; it was the per-request row mapping that piled up).
//
// So the read is memoized per category for a short TTL, and it's the PROMISE that's
// cached, not the value — a burst of concurrent misses then collapses into ONE
// in-flight query instead of a thundering herd. A rejected read is evicted so a
// transient DB error can't be served for the rest of the TTL.
//
// Callers never mutate the cached array: the filter/sort passes below all build new
// arrays, and `enrich` (the only thing that writes to listings) is authed-only and
// bypasses this path entirely.
const PUBLIC_BROWSE_TTL_MS = 60_000;

interface CacheEntry {
  listings: Promise<MarketplaceListing[]>;
  expiresAt: number;
}

const publicBrowseCache = new Map<MarketplaceCategory, CacheEntry>();

/** The published listings for `category`, memoized for PUBLIC_BROWSE_TTL_MS. */
function loadPublicVisible(category: MarketplaceCategory): Promise<MarketplaceListing[]> {
  const now = Date.now();
  const hit = publicBrowseCache.get(category);
  if (hit && hit.expiresAt > now) return hit.listings;

  const listings = withSystem((tx) => ADAPTERS[category].loadVisible(tx)).catch((err: unknown) => {
    publicBrowseCache.delete(category);
    throw err;
  });
  publicBrowseCache.set(category, { listings, expiresAt: now + PUBLIC_BROWSE_TTL_MS });
  return listings;
}

/** Test-only — drop the public browse cache between suites. */
export function _resetPublicBrowseCacheForTest(): void {
  publicBrowseCache.clear();
}

/** Split one query value into facet tokens. A value is a string ("a,b") or a
 *  repeated-key array (["a","b"]); anything else contributes nothing. Typed
 *  narrowly so we never stringify an arbitrary object. */
function facetTokens(value: unknown): string[] {
  const out: string[] = [];
  const push = (s: string): void => {
    for (const t of s.split(',')) {
      const trimmed = t.trim();
      if (trimmed) out.push(trimmed);
    }
  };
  if (typeof value === 'string') push(value);
  else if (Array.isArray(value)) for (const v of value) if (typeof v === 'string') push(v);
  return out;
}

/** Read each facet's selection from the raw query (comma-separated, or a
 *  repeated key). */
function parseFacetParams(
  facets: FacetDef[],
  raw: Record<string, unknown>
): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const f of facets) out[f.key] = new Set(facetTokens(raw[f.key]));
  return out;
}

function sortListings(list: MarketplaceListing[], sort: MarketplaceSort): void {
  switch (sort) {
    case 'name':
      list.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'newest':
      // ISO strings sort lexicographically; nulls (unpublished) sink last.
      list.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
      break;
    case 'price_low':
      list.sort((a, b) => a.price.cents - b.price.cents);
      break;
    case 'price_high':
      list.sort((a, b) => b.price.cents - a.price.cents);
      break;
    case 'popular':
    default:
      list.sort(
        (a, b) =>
          b.sortWeight - a.sortWeight ||
          b.installCount - a.installCount ||
          a.name.localeCompare(b.name)
      );
  }
}

function tally(values: string[]): MarketplaceFacetBucket {
  const out: MarketplaceFacetBucket = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}

export const marketplaceCatalogService = {
  async list(
    category: MarketplaceCategory,
    rawQuery: Record<string, unknown>,
    ctx: CatalogContext,
    options?: ListOptions
  ): Promise<MarketplaceListResponse> {
    const adapter = ADAPTERS[category];
    const facetDefs = [...adapter.facets, ...(options?.extraFacets ?? [])];
    const query = MarketplaceBrowseQuery.parse(rawQuery);
    const params = parseFacetParams(facetDefs, rawQuery);

    // The public path (no tenant, no overlay) is the same set for everyone, so it
    // serves from the shared cache. Anything tenant-scoped or enriched reads live —
    // its result is per-request by definition.
    const cacheable = !ctx.tenantId && !options?.enrich;
    const all = cacheable
      ? await loadPublicVisible(category)
      : await run(ctx, async (tx) => {
          const listings = await adapter.loadVisible(tx);
          if (options?.enrich) await options.enrich(tx, listings);
          return listings;
        });

    // 1. Free-text narrow. Facet COUNTS are computed over this set so the rail
    //    reflects the current search.
    const needle = query.q?.toLowerCase();
    const searched = needle
      ? all.filter((l) => adapter.searchText(l).toLowerCase().includes(needle))
      : all;

    // 2. Facet selections — AND across facets, OR within a facet. `skip` lets the
    //    count pass below exclude a facet's OWN selection.
    const matches = (l: MarketplaceListing, skip?: string): boolean =>
      facetDefs.every(
        (f) =>
          f.key === skip ||
          params[f.key]!.size === 0 ||
          f.values(l).some((v) => params[f.key]!.has(v))
      );

    const matched = searched.filter((l) => matches(l));
    sortListings(matched, query.sort);

    // 3. Page.
    const total = matched.length;
    const page = matched.slice(query.cursor, query.cursor + query.limit);
    const nextOffset = query.cursor + query.limit;
    const next_cursor = nextOffset < total ? String(nextOffset) : null;

    // 4. Facet counts — each over the q-narrowed set with the OTHER facets
    //    applied but its own selection excluded (proper faceted search).
    const facets: Record<string, MarketplaceFacetBucket> = {};
    for (const f of facetDefs) {
      facets[f.key] = tally(searched.filter((l) => matches(l, f.key)).flatMap((l) => f.values(l)));
    }

    return { items: page, total, facets, next_cursor };
  },

  get(
    category: MarketplaceCategory,
    slug: string,
    ctx: CatalogContext,
    options?: Pick<ListOptions, 'enrich'>
  ): Promise<MarketplaceListing | null> {
    const adapter = ADAPTERS[category];
    return run(ctx, async (tx) => {
      const listing = await adapter.loadOne(tx, slug);
      if (listing && options?.enrich) await options.enrich(tx, [listing]);
      return listing;
    });
  },
};
