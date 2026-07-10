// Offset/page-number pagination helpers (docs/34 §7 follow-up). The list pages
// are URL-driven server components: the `ListPager` client wrapper writes
// `?page=` / `?per_page=`, and the server page reads them here to compute the
// fetch window (`skip`/`take`). Keep `DEFAULT_PAGE_SIZE` and `PAGE_SIZE_OPTIONS`
// in sync with the `ListPager` defaults so the size selector round-trips.

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [25, 50, 100];

export interface PageWindow {
  /** 1-based page. */
  page: number;
  /** Rows per page (one of PAGE_SIZE_OPTIONS). */
  perPage: number;
  /** Rows to skip — pass straight to the API `skip` param. */
  skip: number;
  /** Rows to fetch — pass straight to the API `take` param. */
  take: number;
}

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Resolve `?page=` / `?per_page=` from a page's searchParams into a fetch
 * window. Page is clamped to ≥1; an out-of-range or non-listed page size falls
 * back to `defaultPerPage`.
 *
 * Pages that render MULTIPLE independently-paged sections (e.g. Shipping's
 * zones + profiles) pass custom `pageKey` / `perPageKey` so each section reads
 * its own query params — these must match the keys handed to that section's
 * `<ListPager pageKey=… perPageKey=… />`.
 */
export function parsePageParams(
  params: Record<string, string | string[] | undefined>,
  defaultPerPage: number = DEFAULT_PAGE_SIZE,
  keys: { pageKey?: string; perPageKey?: string } = {}
): PageWindow {
  const pageKey = keys.pageKey ?? 'page';
  const perPageKey = keys.perPageKey ?? 'per_page';
  const page = Math.max(1, Math.floor(Number(firstParam(params[pageKey])) || 1));
  const rawPerPage = Math.floor(Number(firstParam(params[perPageKey])) || defaultPerPage);
  const perPage = PAGE_SIZE_OPTIONS.includes(rawPerPage) ? rawPerPage : defaultPerPage;
  return { page, perPage, skip: (page - 1) * perPage, take: perPage };
}
