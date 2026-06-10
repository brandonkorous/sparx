// Public marketplace data layer for apps/web (docs/60 §9, Phase 5). The marketing
// site reads the UNAUTHENTICATED catalog API — `GET /v1/public/marketplace/*` —
// which runs the catalog read under `withSystem` (no tenant), so the
// `marketplace_visibility` RLS policy returns only published+public rows. No
// per-tenant overlay (install/applied/connected state) exists on this surface;
// the funnel hands acquisition off to signup (`signUpHref`).
//
// Types are a LOCAL mirror of the @sparx/marketplace-schemas contract, kept here
// so apps/web takes no new workspace dependency (matching the dashboard's local
// mirror). Keep in lockstep with packages/marketplace-schemas. The `install`
// field is intentionally absent — it never appears on the public surface.
//
// Server-only by construction: it reads `process.env` and is imported only by
// server components + the load-more server action — never shipped to the client.

// In-cluster api-rest URL (k8s/apps/site.yaml injects SPARX_API_REST_URL); the
// public routes need no auth. Falls back to the local api-rest port for dev.
const API_BASE = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

// The dashboard origin the signup funnel lives on. apps/web is sparx.works; the
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

export interface ThemeFacets {
  mood: string | null;
  colorFamily: string | null;
  density: string | null;
  industry: string | null;
}

export interface ComponentFacets {
  group: string;
  kind: string | null;
  surfaces: string[];
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

interface Envelope<T> {
  success: boolean;
  data: T;
}

/** GET a public-catalog path, unwrap the `{ success, data }` envelope. Returns
 *  null on any non-2xx / shape mismatch so callers degrade gracefully (an empty
 *  category page, a 404 detail). The catalog is tenant-agnostic + cacheable, so
 *  responses revalidate every 5 minutes rather than per request. */
async function getPublic<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const body = (await res.json()) as Envelope<T>;
    return body.success ? body.data : null;
  } catch {
    return null;
  }
}

/** A category's faceted, paged catalog page. `query` carries `q`, `sort`,
 *  `cursor`, `limit`, and any facet keys (comma-separated values), passed through
 *  verbatim to the public endpoint. Degrades to an empty page on error. */
export async function fetchCategory(
  category: string,
  query: Record<string, string> = {}
): Promise<MarketplaceListResponse> {
  const qs = new URLSearchParams(query).toString();
  const data = await getPublic<MarketplaceListResponse>(
    `/v1/public/marketplace/${encodeURIComponent(category)}${qs ? `?${qs}` : ''}`
  );
  return data ?? EMPTY_PAGE;
}

/** One listing by slug, or null if it isn't published/public. */
export function fetchListing(category: string, slug: string): Promise<MarketplaceListing | null> {
  return getPublic<MarketplaceListing>(
    `/v1/public/marketplace/${encodeURIComponent(category)}/${encodeURIComponent(slug)}`
  );
}

/**
 * The signup funnel hand-off (docs/54 §15, docs/60 §10). A public listing's CTA
 * sends the visitor to the dashboard signup carrying the intent — `ref=market`
 * for attribution, plus `blueprint=<slug>` so a later onboarding-threading slice
 * can auto-install after the tenant is created. The public side is complete here;
 * consuming the intent (async install on signup) is the separate onboarding slice.
 */
export function signUpHref(intent?: { blueprint?: string }): string {
  const params = new URLSearchParams({ ref: 'market' });
  if (intent?.blueprint) params.set('blueprint', intent.blueprint);
  return `${APP_BASE}/sign-up?${params.toString()}`;
}
