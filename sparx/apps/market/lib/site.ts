// The canonical public origin for sparx.market.
//
// Unlike the tenant storefront (wizeworks/apps/site), which resolves its host per request
// from the Host header, sparx.market is a SINGLE public site on one fixed
// domain — so its origin is a constant, not request-derived.
//
// This exists because the literal was accumulating across the codebase (sitemap,
// robots, layout metadata, llms.txt, and every absolute URL inside JSON-LD).
// Structured data in particular REQUIRES absolute URLs — a relative `item` in a
// BreadcrumbList silently invalidates the entry — so these strings get built by
// hand in a lot of places, and they must all agree.

export const SITE_ORIGIN = 'https://sparx.market';

/** Absolute URL for a site-relative path. Structured data and metadata need
 *  fully-qualified URLs; this keeps the joining consistent (and the leading
 *  slash unambiguous) rather than interpolating by hand at each call site. */
export function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}
