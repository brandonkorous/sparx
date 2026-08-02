// Public bootcamp data layer for apps/web (docs/114 §B.5/§B.6/§B.8). Reads the
// UNAUTHENTICATED bootcamp API — `GET /v1/public/bootcamps` (directory + facets)
// and `GET /v1/public/bootcamps/:slug` (detail) — which run under the published
// RLS policy (status='published'), so only live listings come back.
//
// Server-only: reads `process.env`, imported by server components, the load-more
// action, the detail route, and the sitemap. Degrades to empty on any error so
// the directory + detail always render (empty state / notFound) while the
// endpoints stand up.

import type { FacetCount, PartnerTier } from './partners';

const API_BASE = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

export type BootcampFormat = 'in_person' | 'virtual' | 'hybrid' | 'async';

export interface BootcampHost {
  displayName: string;
  tier: PartnerTier;
}

export interface BootcampCard {
  id: string;
  title: string;
  slug: string;
  format: BootcampFormat;
  locationCity: string | null;
  locationState: string | null;
  locationCountry: string | null;
  startsAt: string | null;
  endsAt: string | null;
  seatsTotal: number | null;
  seatsFilled: number;
  priceCents: number;
  currency: string;
  host: BootcampHost;
}

export interface BootcampDetail extends BootcampCard {
  /** Rich HTML from the TipTap description editor. */
  description: string;
  registrationMode: 'internal' | 'external';
  registrationUrl: string | null;
}

export interface BootcampListResponse {
  items: BootcampCard[];
  facets: { format: FacetCount[]; location: FacetCount[] };
  next_cursor: string | null;
}

// The API response is untrusted at the boundary — an older api-rest (or a shape
// drift) can omit a facet array entirely. We model it loosely here and coerce to
// the strict BootcampListResponse in fetchBootcamps so the public page can never
// 500 on a missing key (the bug that took /bootcamp down: `facets.location` was
// absent and `[...facets.location]` threw).
interface RawBootcampList {
  items?: BootcampCard[];
  facets?: { format?: FacetCount[]; location?: FacetCount[] };
  next_cursor?: string | null;
}

const EMPTY_PAGE: BootcampListResponse = {
  items: [],
  facets: { format: [], location: [] },
  next_cursor: null,
};

interface Envelope<T> {
  success: boolean;
  data: T;
}

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

/** The faceted, paged public directory. `query` carries `format`, `location`,
 *  `from`, `to`, `q`, `cursor`, `limit`. Degrades to an empty page on error. */
export async function fetchBootcamps(
  query: Record<string, string> = {}
): Promise<BootcampListResponse> {
  const qs = new URLSearchParams(query).toString();
  const data = await getPublic<RawBootcampList>(`/v1/public/bootcamps${qs ? `?${qs}` : ''}`);
  if (!data) return EMPTY_PAGE;
  return {
    items: data.items ?? [],
    facets: {
      format: data.facets?.format ?? [],
      location: data.facets?.location ?? [],
    },
    next_cursor: data.next_cursor ?? null,
  };
}

/** One published bootcamp by slug, or null if not published/found. */
export function fetchBootcamp(slug: string): Promise<BootcampDetail | null> {
  return getPublic<BootcampDetail>(`/v1/public/bootcamps/${encodeURIComponent(slug)}`);
}

/** The directory's own cap on `limit` (BootcampDirectoryQuery). Anything larger
 *  is a 422, and `getPublic` turns a non-2xx into an empty page — so `limit=200`
 *  did not return a wide page, it returned NOTHING, and every published bootcamp
 *  has been silently absent from the sitemap. Found 2026-08-02 while adding the
 *  identical enumeration for partners. Page through the cursor instead. */
const DIRECTORY_PAGE_SIZE = 48;
/** 48 × 40 = 1,920 bootcamps before the sitemap reports a bound. */
const MAX_SLUG_PAGES = 40;

/** Published slugs for the sitemap. Degrades to whatever it has when the API
 *  errors — a down endpoint narrows coverage, it never fails the sitemap route —
 *  and a hit cap is logged rather than silent (docs/50 §6). */
export async function fetchPublishedBootcampSlugs(): Promise<string[]> {
  const slugs: string[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_SLUG_PAGES; page++) {
    const query: Record<string, string> = { limit: String(DIRECTORY_PAGE_SIZE) };
    if (cursor) query.cursor = cursor;
    const result = await fetchBootcamps(query);
    slugs.push(...result.items.map((b) => b.slug).filter(Boolean));
    if (!result.next_cursor) return slugs;
    cursor = result.next_cursor;
  }
  console.warn(
    `[sitemap] bootcamp enumeration hit its cap; coverage is bounded at ${slugs.length} bootcamps.`
  );
  return slugs;
}

export const FORMAT_LABEL: Record<BootcampFormat, string> = {
  in_person: 'In-person',
  virtual: 'Virtual',
  hybrid: 'Hybrid',
  async: 'Async',
};

/** "Austin, TX" · "Online" (virtual/async) · "Remote" fallback. */
export function bootcampLocation(
  b: Pick<BootcampCard, 'format' | 'locationCity' | 'locationState'>
): string {
  if (b.locationCity) {
    return b.locationState ? `${b.locationCity}, ${b.locationState}` : b.locationCity;
  }
  return b.format === 'in_person' || b.format === 'hybrid' ? 'Location TBA' : 'Online';
}

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const DAY_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/** "Mar 14–16, 2026" · "Mar 14 – Apr 2, 2026" · "Starts anytime" for async with
 *  no dates. Collapses same-year ranges to one trailing year. */
export function bootcampDates(b: Pick<BootcampCard, 'format' | 'startsAt' | 'endsAt'>): string {
  if (!b.startsAt) return b.format === 'async' ? 'Starts anytime' : 'Dates TBA';
  const start = new Date(b.startsAt);
  if (!b.endsAt) return DATE_FMT.format(start);
  const end = new Date(b.endsAt);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  if (sameMonth) {
    return `${DAY_FMT.format(start)}–${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  }
  if (sameYear) {
    return `${DAY_FMT.format(start)} – ${DATE_FMT.format(end)}`;
  }
  return `${DATE_FMT.format(start)} – ${DATE_FMT.format(end)}`;
}

/** ISO-8601 date for machine contexts (Event JSON-LD startDate/endDate). */
export function bootcampIsoDate(value: string | null): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Seats-remaining label — only shown when the host capped capacity. Returns
 *  null for unlimited seats (no scarcity signal to show). */
export function seatsLabel(
  b: Pick<BootcampCard, 'seatsTotal' | 'seatsFilled'>
): { text: string; full: boolean } | null {
  if (b.seatsTotal == null) return null;
  const left = Math.max(0, b.seatsTotal - b.seatsFilled);
  if (left === 0) return { text: 'Waitlist only', full: true };
  return { text: `${left} seat${left === 1 ? '' : 's'} left`, full: false };
}

/** Price label — "Free" for $0, else a whole-dollar amount. */
export function bootcampPrice(b: Pick<BootcampCard, 'priceCents' | 'currency'>): string {
  if (!b.priceCents) return 'Free';
  const dollars =
    b.priceCents % 100 === 0 ? `$${b.priceCents / 100}` : `$${(b.priceCents / 100).toFixed(2)}`;
  return dollars;
}
