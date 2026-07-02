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

/** A fuller record for the public profile route. */
export interface PartnerProfile extends PartnerCard {
  locationCountry?: string | null;
  headline?: string | null;
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
  const data = await getPublic<PartnerListResponse>(`/v1/public/partners${qs ? `?${qs}` : ''}`);
  return data ?? EMPTY_PAGE;
}

/** One public partner profile by id, or null if not listable. */
export function fetchPartner(id: string): Promise<PartnerProfile | null> {
  return getPublic<PartnerProfile>(`/v1/public/partners/${encodeURIComponent(id)}`);
}

/** Tier display metadata — label + the @sparx/ui Badge color slot. Certified
 *  wears the platform indigo (primary, top of directory); registered reads as a
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
