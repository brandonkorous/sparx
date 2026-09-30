// IS THE SITE ON THIS HOST DARK, asked early enough to set a status code.
//
// ── WHY THIS IS AT THE EDGE AND NOT IN THE LAYOUT ──────────────────────────
//
// The layout already knows: `site.billingPhase === 'suspended'` is checked there
// and serves the "Back soon" overlay. What a layout cannot do is set a status,
// so every dark PAGE answered 200 while the same site's robots.txt answered 503
// — one outage, two answers, and the 200 is the one that lets the dark page be
// indexed in place of the shop (issue 844).
//
// The proxy is the only place in the request that can both know the phase and
// choose the status. So the question is asked here.
//
// ── WHAT IT COSTS, AND WHAT KEEPS IT SMALL ─────────────────────────────────
//
// A tenant lookup on the busiest path in the platform would be a bad trade for a
// state that is rare by design. Three things keep it from being one:
//
//   1. DOCUMENTS ONLY. An image, a script, a font and a `_next` chunk are not
//      search results and nobody reads their status. Only the requests a crawler
//      weighs are asked about.
//   2. CACHED PER HOST, for the same ten minutes `Retry-After` already promises
//      a crawler. A busy live shop costs one lookup per host per ten minutes,
//      not one per request.
//   3. FAIL OPEN, ALWAYS. A lookup that errors, times out or answers oddly
//      leaves the site serving. The resolver downstream already follows this
//      rule — "a site is NEVER suspended on missing data" — and a guard that can
//      dark a paid-up shop because an API blinked is worse than the bug it fixes.
//
// Nothing here ever darkens a site on its own: it only answers the question the
// tenant record already answers, sooner.

import { isLocalDevHost, zoneSiteRoute } from './site-host';

const BASE_URL = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

/** The same ten minutes `Retry-After` promises. Holding the answer longer than
 *  we ask a crawler to wait would keep a shop dark after it has paid. */
const PHASE_TTL_MS = 600_000;

/** How long to wait for the phase before serving the site anyway. Short on
 *  purpose: this sits in front of every document, and a slow answer must cost
 *  the shop a correct status code, never a visitor. */
const PHASE_TIMEOUT_MS = 1_500;

/** Paths that are never a search result, so never worth a lookup. */
const ASSET_PATH =
  /\.(?:ico|png|jpe?g|gif|svg|webp|avif|css|js|mjs|map|woff2?|ttf|otf|eot|json|webmanifest)$/i;

/**
 * Is this a request whose status code anyone will read?
 *
 * `robots.txt`, `sitemap.xml` and `llms.txt` are excluded because they answer
 * their own 503 already, from `lib/suspended` — asking twice would cost a lookup
 * to reach the same answer.
 */
export function isCrawlablePath(pathname: string): boolean {
  if (pathname.startsWith('/_next') || pathname.startsWith('/api/')) return false;
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml' || pathname === '/llms.txt') {
    return false;
  }
  return !ASSET_PATH.test(pathname);
}

/**
 * The tenant whose site answers on this host, or null when only the domains
 * table knows.
 *
 * A zone host is self-describing, so it costs nothing. Local dev reads the
 * override the proxy itself relays. A custom domain is left to the layout: it
 * would need a second round trip at the edge, and one is the budget.
 */
export function tenantSlugForHost(host: string, devSlug: string | null): string | null {
  const zone = zoneSiteRoute(host);
  if (zone) return zone.tenantSlug;
  if (isLocalDevHost(host) && devSlug) return devSlug;
  return null;
}

/** host → the phase we last read, and when. Module scope, so it lives as long as
 *  the edge instance does and no longer. */
const seen = new Map<string, { dark: boolean; at: number }>();

/** Exported for the tests, which need each case to start from nothing. */
export function forgetPhases(): void {
  seen.clear();
}

/**
 * Is the tenant on this host dark right now?
 *
 * False for every reason that is not a clear yes: no tenant decoded, the lookup
 * failed, the payload was not what we expected, the phase was anything else.
 */
export async function siteIsDark(host: string, devSlug: string | null): Promise<boolean> {
  const slug = tenantSlugForHost(host, devSlug);
  if (!slug) return false;

  const key = `${host}\n${slug}`;
  const cached = seen.get(key);
  if (cached && Date.now() - cached.at < PHASE_TTL_MS) return cached.dark;

  const dark = await readPhase(slug);
  seen.set(key, { dark, at: Date.now() });
  return dark;
}

async function readPhase(slug: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/v1/public/tenants/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(PHASE_TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { data?: { billingPhase?: string } };
    return json.data?.billingPhase === 'suspended';
  } catch {
    return false;
  }
}
