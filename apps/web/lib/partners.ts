// Public partner-directory data layer for apps/web (docs/114 §B.6/§B.8). The
// marketing site reads the UNAUTHENTICATED partner API — `GET /v1/public/partners`
// — which runs under the published-directory RLS policy (status='active' AND
// directory_visible), so only listable partners come back. No per-tenant overlay.
//
// Server-only by construction: reads `process.env`, imported only by server
// components + the load-more server action. Degrades to empty results on any
// error so every page still renders its empty state while the endpoints stand up.

const API_BASE = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

// The dashboard origin the apply/activation funnel hands off to (app.sparx.works).
export const APP_BASE = process.env.SPARX_APP_URL ?? 'https://app.sparx.works';

export type PartnerTier = 'informal' | 'registered' | 'certified';
export type PartnerKind = 'freelance' | 'agency' | 'developer' | 'other';

export interface PartnerCard {
  id: string;
  /** The public profile URL segment — `/partners/<slug>`. Minted from the
   *  display name when the partner is approved, and never moved after that. */
  slug: string;
  displayName: string;
  tier: PartnerTier;
  /** The application "what describes you" value — one of PartnerKind, but typed
   *  wide since it's a free API string the card never switches on. */
  kind: string;
  bio: string | null;
  locationCity: string | null;
  locationState: string | null;
  isRemote: boolean;
  specialties: string[];
  websiteUrl: string | null;
  photoUrl: string | null;
}

/** A fuller record for the public profile route — the card, plus the fields only
 *  /partners/[slug] needs. (`headline` was declared here and never existed on
 *  the Partner model or in any response; removed rather than left as a field a
 *  future profile section could be built on and find permanently undefined.) */
export interface PartnerProfile extends PartnerCard {
  locationCountry?: string | null;
}

/** One facet value + its result count, as returned by the public facets block. */
export interface FacetCount {
  value: string;
  count: number;
}

export interface PartnerListResponse {
  items: PartnerCard[];
  facets: { tier: FacetCount[]; specialty: FacetCount[] };
  next_cursor: string | null;
}

// Loose shape for the untrusted API response — a shape drift (or an older
// api-rest) can omit a facet array, and the facet bar spreads them
// (`[...facets.specialty]`), which would throw. fetchPartners coerces this to the
// strict response so the public directory can never 500 on a missing key.
interface RawPartnerList {
  items?: PartnerCard[];
  facets?: { tier?: FacetCount[]; specialty?: FacetCount[] };
  next_cursor?: string | null;
}

const EMPTY_PAGE: PartnerListResponse = {
  items: [],
  facets: { tier: [], specialty: [] },
  next_cursor: null,
};

interface Envelope<T> {
  success: boolean;
  data: T;
}

/** GET a public path, unwrap the `{ success, data }` envelope. Returns null on
 *  any non-2xx / shape mismatch so callers degrade gracefully. Cacheable +
 *  tenant-agnostic, so responses revalidate every 5 minutes. */
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

/** The faceted, paged public directory. `query` carries `tier`, `specialty`,
 *  `location`, `remote`, `q`, `cursor`, `limit`, passed through verbatim.
 *  Degrades to an empty page on error. */
export async function fetchPartners(
  query: Record<string, string> = {}
): Promise<PartnerListResponse> {
  const qs = new URLSearchParams(query).toString();
  const data = await getPublic<RawPartnerList>(`/v1/public/partners${qs ? `?${qs}` : ''}`);
  if (!data) return EMPTY_PAGE;
  return {
    items: data.items ?? [],
    facets: {
      tier: data.facets?.tier ?? [],
      specialty: data.facets?.specialty ?? [],
    },
    next_cursor: data.next_cursor ?? null,
  };
}

/** One public partner profile by its URL slug, or null when there is no listable
 *  partner behind it — a 404, a suspended partner, an opt-out, or a down API all
 *  arrive here as null so the page can call `notFound()` itself rather than
 *  rendering a half-empty profile. */
export function fetchPartner(slug: string): Promise<PartnerProfile | null> {
  return getPublic<PartnerProfile>(`/v1/public/partners/slug/${encodeURIComponent(slug)}`);
}

/** The directory's own cap on `limit` (PartnerDirectoryQuery). Anything larger
 *  is a 422, and `getPublic` turns a non-2xx into an empty page — so asking for
 *  one oversized page yields ZERO coverage rather than a truncated list, and
 *  does it silently. Page through the cursor instead. */
const DIRECTORY_PAGE_SIZE = 48;
/** 48 × 40 = 1,920 partners before the sitemap reports a bound. */
const MAX_SLUG_PAGES = 40;

/** Every listable partner's slug, for the sitemap. Degrades to whatever it has
 *  when the API errors — a down endpoint narrows coverage, it never fails the
 *  sitemap route — and a hit cap is logged rather than silent (docs/50 §6). */
export async function fetchPartnerSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_SLUG_PAGES; page++) {
    const query: Record<string, string> = { limit: String(DIRECTORY_PAGE_SIZE) };
    if (cursor) query.cursor = cursor;
    const result = await fetchPartners(query);
    slugs.push(...result.items.map((p) => p.slug).filter(Boolean));
    if (!result.next_cursor) return slugs;
    cursor = result.next_cursor;
  }
  console.warn(
    `[sitemap] partner enumeration hit its cap; coverage is bounded at ${slugs.length} partners.`
  );
  return slugs;
}

/** Tier display metadata — label + the @sparx/ui Badge color slot. Certified
 *  wears the platform Ember (primary, top of directory); registered reads as a
 *  reviewed cyan/info; informal is a neutral, unverified pill. */
export const TIER_META: Record<PartnerTier, { label: string; color: string }> = {
  certified: { label: 'Certified', color: 'primary' },
  registered: { label: 'Registered', color: 'info' },
  informal: { label: 'Informal', color: 'neutral' },
};

/** "City, ST" · "Remote" · or null when a partner lists no location. */
export function partnerLocation(
  p: Pick<PartnerCard, 'locationCity' | 'locationState' | 'isRemote'>
): string | null {
  if (p.locationCity) {
    return p.locationState ? `${p.locationCity}, ${p.locationState}` : p.locationCity;
  }
  if (p.isRemote) return 'Remote';
  return null;
}

/** The self-serve activation hand-off. Informal auto-approves into signup with
 *  the partner intent pre-selected; others go through the reviewed apply form. */
export function partnerSignupHref(tier: PartnerTier = 'informal'): string {
  return `${APP_BASE}/sign-up?partner=${encodeURIComponent(tier)}`;
}
