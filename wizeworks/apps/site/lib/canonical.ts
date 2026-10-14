// The one address a page tells search engines is its own (`<link rel="canonical">`).
//
// No page on a site said it (P09). A site answers on its own subdomain, on a custom
// domain once one is connected, and with any query a link happens to carry, so a search
// engine met one page at several addresses and was left to guess which one to list. The
// sitemap already names one host per site (`canonicalSiteHost` in api-rest); this names
// the same one, so the two never disagree.

/** The page number a canonical keeps: page 2 of a journal is its own page, not a copy
 *  of page 1. Anything that is not a whole number above 1 is page 1. */
function pageOf(raw: string | null | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const page = Number(raw);
  return page > 1 ? page : null;
}

/**
 * A page's canonical URL: the site's own origin, the path without a trailing slash, and
 * the page number when it is past the first. Every other query (a filter, a share
 * tracker, the dev `?tenant=` switch) is left out, because none of them makes a
 * different page.
 */
export function canonicalUrl(origin: string, path: string, page?: string | null): string {
  const base = origin.replace(/\/+$/, '');
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path;
  const n = pageOf(page);
  return `${base}${clean || '/'}${n ? `?page=${n}` : ''}`;
}
