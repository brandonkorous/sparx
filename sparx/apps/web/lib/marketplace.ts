// Public marketplace data layer for sparx/apps/web (docs/60 §9, Phase 5). The marketing
// site reads the UNAUTHENTICATED catalog API — `GET /v1/public/marketplace/*` —
// which runs the catalog read under `withSystem` (no tenant), so the
// `marketplace_visibility` RLS policy returns only published+public rows. No
// per-tenant overlay (install/applied/connected state) exists on this surface;
// the funnel hands acquisition off to signup (`signUpHref`).
//
// Types are a LOCAL mirror of the @wizeworks/marketplace-schemas contract, kept here
// so sparx/apps/web takes no new workspace dependency (matching the dashboard's local
// mirror). Keep in lockstep with packages/marketplace-schemas. The `install`
// field is intentionally absent — it never appears on the public surface.
//
// Server-only by construction: it reads `process.env` and is imported only by
// server components + the load-more server action — never shipped to the client.

import { canonicalQueryString } from './browse-params';
import { renderComponentPreview } from './component-preview-render';

// In-cluster api-rest URL (k8s/apps/site.yaml injects SPARX_API_REST_URL); the
// public routes need no auth. Falls back to the local api-rest port for dev.
const API_BASE = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

// The dashboard origin the signup funnel lives on. sparx/apps/web is sparx.works; the
// dashboard is app.sparx.works — so the hand-off is an ABSOLUTE cross-origin URL.
const APP_BASE = process.env.SPARX_APP_URL ?? 'https://app.sparx.works';

export type MarketplaceCategoryId = 'blueprints' | 'themes' | 'components' | 'integrations';

export interface MarketplaceMedia {
  url: string;
  alt?: string;
  kind: 'image' | 'video';
}

export interface MarketplacePublisherDto {
  id: string;
  type: 'sparx' | 'tenant' | 'partner';
  slug: string;
  displayName: string;
  verified: boolean;
  websiteUrl: string | null;
}

export interface BlueprintContents {
  products: number;
  categories: number;
  collections: number;
  content: number;
  pages: number;
  emails: number;
  components: number;
  theme: string | null;
  hasLayout: boolean;
}

export interface BlueprintFacets {
  vertical: string;
  requiredModules: string[];
  contents: BlueprintContents;
}

export interface ThemePreviewFont {
  family: string;
  source: 'system' | 'google';
  weights?: number[];
}

export interface ThemeFacets {
  mood: string | null;
  colorFamily: string | null;
  density: string | null;
  industry: string | null;
  // Live-preview render inputs (docs/118): the silica token bag rendered in-browser
  // instead of a baked image. Present on browse + detail; null on a legacy row.
  tokens?: Record<string, string> | null;
  dark?: Record<string, string> | null;
  fonts?: { sans?: ThemePreviewFont; head?: ThemePreviewFont } | null;
}

export interface ComponentFacets {
  group: string;
  kind: string | null;
  surfaces: string[];
  dataBacked?: boolean;
  // The silica node tree the API returns (docs/118). Consumed ONLY server-side (this
  // module renders it to `previewHtml`); stripped before the listing reaches the
  // client so the heavy tree never rides the wire.
  tree?: Record<string, unknown> | null;
  // The section rendered to HTML against neutral sample data — produced in this
  // server-only layer so the silica renderer never ships to the client. The card +
  // detail inject it inside a base-theme surface. Null on a legacy row.
  previewHtml?: string | null;
}

export interface IntegrationFacets {
  providerSlug: string;
  kind: string;
  scopes: string[];
}

/** The normalized listing the browse/detail UI renders for any category. Exactly
 *  the block matching `category` is populated. */
export interface MarketplaceListing {
  category: MarketplaceCategoryId;
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  media: MarketplaceMedia[];
  icon: string | null;
  accent: string | null;
  version: string;
  publisher: MarketplacePublisherDto;
  price: { cents: number; model: 'free' | 'one_time' | 'subscription' };
  status: string;
  visibility: string;
  installCount: number;
  rating: { average: number; count: number };
  sortWeight: number;
  publishedAt: string | null;
  blueprint: BlueprintFacets | null;
  theme: ThemeFacets | null;
  component: ComponentFacets | null;
  integration: IntegrationFacets | null;
}

/** facetKey → (value → count). */
export type MarketplaceFacetBucket = Record<string, number>;

/** The faceted, paged catalog response (docs/60 §6) — identical shape on both
 *  surfaces and across the SQL adapter today / Typesense later. */
export interface MarketplaceListResponse {
  items: MarketplaceListing[];
  total: number;
  facets: Record<string, MarketplaceFacetBucket>;
  next_cursor: string | null;
}

const EMPTY_PAGE: MarketplaceListResponse = { items: [], total: 0, facets: {}, next_cursor: null };

/** Render a component listing's stored tree to preview HTML server-side (docs/118),
 *  then DROP the tree so it never travels to the client. A no-op for other categories
 *  and for a legacy component row with no tree (the UI falls back to a placeholder). */
function withComponentPreview(item: MarketplaceListing): MarketplaceListing {
  const c = item.component;
  if (item.category !== 'components' || !c) return item;
  const previewHtml = c.tree ? renderComponentPreview(c.tree) : null;
  return { ...item, component: { ...c, previewHtml, tree: null } };
}

interface Envelope<T> {
  success: boolean;
  data: T;
}

/** How long a fetched catalog response is cached. The catalog is tenant-agnostic +
 *  cacheable, so prod revalidates every 5 minutes rather than per request. In dev the
 *  window is short so a re-ingest (new bundle payloads) shows up almost immediately
 *  instead of after the full 5-minute window. */
const CATALOG_REVALIDATE = process.env.NODE_ENV === 'production' ? 300 : 5;

/** GET a public-catalog path, unwrap the `{ success, data }` envelope. Returns
 *  null on any non-2xx / shape mismatch so callers degrade gracefully (an empty
 *  category page, a 404 detail). */
async function getPublic<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: CATALOG_REVALIDATE } });
    if (!res.ok) return null;
    const body = (await res.json()) as Envelope<T>;
    return body.success ? body.data : null;
  } catch {
    return null;
  }
}

/** A category's faceted, paged catalog page. `query` carries `q`, `sort`,
 *  `cursor`, `limit`, and any facet keys (comma-separated values). Degrades to an
 *  empty page on error.
 *
 *  The query is CANONICALIZED before it becomes a URL, because that URL is the
 *  fetch cache's key: without it, the same logical query spelled two ways is two
 *  cold entries and two real api-rest reads. Canonicalizing here (not only at the
 *  call sites) means every caller — page, `generateMetadata`, the load-more action
 *  — shares one cache entry. See lib/browse-params. */
export async function fetchCategory(
  category: string,
  query: Record<string, string> = {}
): Promise<MarketplaceListResponse> {
  const qs = canonicalQueryString(category, query);
  const data = await getPublic<MarketplaceListResponse>(
    `/v1/public/marketplace/${encodeURIComponent(category)}${qs ? `?${qs}` : ''}`
  );
  if (!data) return EMPTY_PAGE;
  return { ...data, items: data.items.map(withComponentPreview) };
}

/** One listing by slug, or null if it isn't published/public. */
export async function fetchListing(
  category: string,
  slug: string
): Promise<MarketplaceListing | null> {
  const item = await getPublic<MarketplaceListing>(
    `/v1/public/marketplace/${encodeURIComponent(category)}/${encodeURIComponent(slug)}`
  );
  return item ? withComponentPreview(item) : null;
}

/** Hard bound on sitemap enumeration per category. The catalog is curated (tens
 *  to low hundreds per category), so this is headroom rather than a real cap —
 *  but it IS a cap, so `fetchListingSlugs` reports when it truncates instead of
 *  silently under-reporting coverage. */
const SITEMAP_PAGE_SIZE = 100;
const SITEMAP_MAX_PER_CATEGORY = 1_000;

/** Every published+public listing slug in a category, for sitemap coverage.
 *  Walks `next_cursor` rather than taking the first page — a category that grew
 *  past one page would otherwise drop out of the index silently. Degrades to the
 *  slugs gathered so far on any error, so a mid-walk api-rest blip narrows
 *  coverage instead of emptying it. `truncated` is surfaced (not swallowed) so
 *  the caller can log an explicit coverage bound. */
export async function fetchListingSlugs(
  category: string
): Promise<{ slugs: string[]; truncated: boolean }> {
  const slugs: string[] = [];
  let cursor: string | null = null;

  do {
    const query: Record<string, string> = { limit: String(SITEMAP_PAGE_SIZE) };
    if (cursor) query.cursor = cursor;

    const page = await fetchCategory(category, query);
    if (page.items.length === 0) break;

    slugs.push(...page.items.map((item) => item.slug));
    cursor = page.next_cursor;
  } while (cursor && slugs.length < SITEMAP_MAX_PER_CATEGORY);

  return {
    slugs: slugs.slice(0, SITEMAP_MAX_PER_CATEGORY),
    truncated: slugs.length >= SITEMAP_MAX_PER_CATEGORY && cursor !== null,
  };
}

/**
 * The signup funnel hand-off (docs/54 §15, docs/60 §10). A public listing's CTA
 * sends the visitor to the dashboard signup carrying the intent — `ref=market`
 * for attribution, plus `blueprint=<slug>` (auto-install the starter site),
 * `theme=<slug>` (preselect the silica theme, docs/118), or `component=<slug>`
 * (the section to insert first) so a later onboarding slice can apply it after the
 * tenant is created. The public side is complete here; consuming the intent (async
 * install/apply on signup) is the separate onboarding slice.
 */
export function signUpHref(intent?: {
  blueprint?: string;
  theme?: string;
  component?: string;
}): string {
  const params = new URLSearchParams({ ref: 'market' });
  if (intent?.blueprint) params.set('blueprint', intent.blueprint);
  if (intent?.theme) params.set('theme', intent.theme);
  if (intent?.component) params.set('component', intent.component);
  return `${APP_BASE}/sign-up?${params.toString()}`;
}
