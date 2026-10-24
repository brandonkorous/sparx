// A browse URL past the facet cap, answered at the edge.
//
// The page already 404s it before any catalog read (MAX_FACET_SELECTIONS), but a
// scraper on rotating residential IPs still sends ~4 a second, and each one paid
// for a Next render of the not-found page plus an attribution Set-Cookie. This
// answers it in the proxy instead: no render, no cookie.

import { countFacetSelections, MAX_FACET_SELECTIONS, type BrowseParams } from './browse-params';

const CATEGORY_BROWSE = /^\/market\/([^/]+)\/?$/;

/** A 404 for a `/market/<category>` URL selecting more facets than the cap, else null. */
export function facetFloodResponse(url: URL): Response | null {
  const category = CATEGORY_BROWSE.exec(url.pathname)?.[1];
  if (!category || !url.search) return null;
  const params: BrowseParams = Object.fromEntries(url.searchParams);
  if (countFacetSelections(category, params) <= MAX_FACET_SELECTIONS) return null;
  return new Response('Not found.', {
    status: 404,
    headers: { 'content-type': 'text/plain', 'cache-control': 'public, max-age=3600' },
  });
}
