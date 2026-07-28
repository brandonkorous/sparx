// The `site.pagination` host core — page links for a bound list on an authored page.
//
// WHY THIS IS A HOST CORE AND NOT A COMPOSITE. Pagination is almost entirely
// conditional, and a bound silica tree has no conditional. There is no Previous link
// on page one, no Next on the last, the current page is text rather than a link, the
// window of numbers around it shifts as you walk, and the whole control must render
// NOTHING when everything already fits on one page. A repeat over a list of URLs can
// express none of that — it would put a dead "Previous" under page one of every site
// on the platform. Same wall `site.brand`'s `show` hit; see `host-nodes.ts`.
//
// AND IT MUST NOT BE THE THING THAT LIES. If the route could not tell us what it
// paginated — no list on the page, a fetch that failed, an author who placed the pager
// under a curated rail that has no pages — this renders nothing at all. A pager that
// invents a page 2 sends a reader to an empty grid, which is worse than no pager: the
// first is a broken promise, the second is just a missing convenience.

import { Pagination } from '@/components/pagination';

/** What the route measured for one bound list. Mirrors `ListPaging` in
 *  `lib/silica-data.ts` — the storefront's own shape, restated here so this component
 *  depends on the facts rather than on the loader that produced them. */
export interface ListPagingFacts {
  source: string;
  param: string;
  page: number;
  totalPages: number | null;
}

/**
 * Choose which list this pager drives.
 *
 * `list` empty — the default, and what an author who never opened the setting has —
 * means "the one on this page", which is correct because a page with exactly one
 * paginated list is the overwhelming case. A named list that is not on this page
 * matches nothing and the pager stays silent, which is the right answer for a pager
 * copied onto a page whose grid was never added.
 */
export function pickPaging(
  paging: readonly ListPagingFacts[],
  list: string | undefined
): ListPagingFacts | null {
  if (paging.length === 0) return null;
  if (!list) return paging.length === 1 ? (paging[0] ?? null) : null;
  return paging.find((p) => p.source === list) ?? null;
}

export function ListPagination({
  paging,
  list,
  basePath,
  searchParams,
}: {
  paging: readonly ListPagingFacts[];
  list?: string;
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const active = pickPaging(paging, list);
  // One page (or none) means there is nothing to move to. Rendering an inert control
  // would be visual noise on the majority of sites, which have fewer than 24 of
  // anything.
  if (!active?.totalPages || active.totalPages <= 1) return null;

  return (
    <Pagination
      basePath={basePath}
      currentParams={searchParams}
      page={active.page}
      totalPages={active.totalPages}
      param={active.param}
    />
  );
}
