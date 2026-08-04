// Paging a bound collection — the arithmetic the storefront and its pager share.
//
// WHY THIS IS A PACKAGE AND NOT A ROUTE HELPER. Three separate things have to agree on
// "what page am I on and what am I showing": the server route that FETCHES the slice
// (`apps/site/lib/silica-data.ts`), the `site.pagination` host core that renders the
// Previous/Next links, and the bound `…From` / `…To` / `…Pages` refs a template can put
// in a "Showing 25–48 of 137" line. Each one derived it independently at first, which is
// how a pager offers a Next link to a page the fetch already knows is empty.
//
// It lives beside `RAIL_MAX_ITEMS` / `COLLECTION_PAGE_ITEMS` and `collectSilicaSourceNeeds`
// deliberately: this package already owns how much of a list gets loaded, and how far
// through it you are is the same question asked from the other end.
//
// Everything here is pure and total — no throws. A page number arrives from a URL, which
// means it arrives from anywhere: a hand-edit, a stale bookmark, a crawler following a
// link that used to exist. The honest response to `?page=banana` is page one, not a 500.

/**
 * What a bound collection on a page is showing, and how to move it.
 *
 * The storefront hands this to the `site.pagination` host core, which is where the links
 * are actually rendered — a bound tree cannot express "no Previous link on page one", so
 * the platform renders that part in React (the same reasoning that made the brand mark a
 * host core).
 */
export interface ListPaging {
  /** The root key this describes — `commerce.product`, `cms.blog_post`. */
  source: string;
  /**
   * The URL query parameter that moves this list.
   *
   * `page` when it is the only paginated list on the page, which is nearly always — a
   * plain `?page=2` is what a reader bookmarks and a search engine crawls. A page
   * carrying TWO bound collections (a product grid and a journal index) cannot share one
   * parameter without moving both at once, so each takes a suffixed one instead.
   */
  param: string;
  page: number;
  perPage: number;
  /** How many records exist. `null` where the source cannot tell us — the CMS entries
   *  endpoint counts only when asked by page number, so a cursor-walked list has no
   *  total and the pager says "Next" rather than "of 9". */
  total: number | null;
  totalPages: number | null;
  /** True when there is at least one more page. Always knowable, even where `total` is
   *  not — which is why the pager is built on this and not on the total. */
  hasMore: boolean;
}

/**
 * The URL-safe short name for a source key: `commerce.product` → `product`,
 * `cms.blog_post` → `blog-post`.
 *
 * Only used when a page has more than one paginated list and they need to move
 * independently. `alone` is passed rather than inferred because the caller is the only
 * thing that knows how many paginated lists the whole page ended up with.
 */
export function pagingParamFor(source: string, alone: boolean): string {
  if (alone) return 'page';
  const last = source.split('.').pop() ?? source;
  return `page-${last.replace(/_/g, '-')}`;
}

/**
 * Read a page number out of a route's search params.
 *
 * Anything that is not a positive integer is page one. `?page=banana`, `?page=0`,
 * `?page=-3` and `?page=` are all somebody's typo or somebody's crawler, and the first
 * page is the answer that costs nothing; an error page is a 500 in a search index.
 *
 * An ARRAY takes its first entry, because `?page=2&page=3` is a real thing a proxy or a
 * duplicated form field produces, and Next hands it over as `string[]`.
 */
export function pageFrom(
  params: Record<string, string | string[] | undefined> | undefined,
  param: string
): number {
  const raw = params?.[param];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/**
 * How many pages a total covers, or `null` when the source cannot count.
 *
 * At least one, always: a collection with nothing in it is on page one of one, not page
 * one of zero. "Page 1 of 0" is the shape that makes a pager render a disabled Next
 * beside a disabled Previous and look broken rather than empty.
 */
export function totalPagesFor(total: number | null | undefined, perPage: number): number | null {
  if (total == null || perPage < 1) return null;
  return Math.max(1, Math.ceil(total / perPage));
}

/**
 * Did the reader ask for a page that does not exist — `?page=99` on a list one page long?
 *
 * WHY THIS HAS TO BE A 404 AND CANNOT BE FIXED IN RESOLUTION. An empty collection resolves
 * to `[]`, and silica renders a repeat over `[]` as its template ONCE — deliberately, because
 * on the studio canvas no record is ever in scope and a template that vanished would leave the
 * author a blank region with nothing to click. On a PUBLIC page that same rule published a
 * fake post: `/blog?page=2` served a card reading "Post title" / "The short summary of this
 * post, written in the CMS" with an image that had no `src`. Found live 2026-08-02.
 *
 * The tempting fix — make an empty collection drop its children — is the one thing that must
 * not happen: `hideWhenEmpty` is opt-in precisely because the site builder relies on the
 * opposite, and flipping it globally would silently delete authored placeholder copy from
 * every published site (see `silica-resolve.ts`). The defect is not that an empty list renders
 * its template; it is that a URL naming a page that does not exist returned 200 at all.
 *
 * So the answer is the HTTP one, which is also what a crawler expects: out of range is Not
 * Found. Page 1 is never out of range — an empty collection is legitimately "page 1 of 1", and
 * 404-ing an empty blog would hide a site that simply has not published yet.
 *
 * `totalPages: null` means the source cannot count (a cursor-walked list), so nothing is
 * provably out of range and this stays false rather than guessing.
 */
export function pageOutOfRange(paging: readonly ListPaging[]): boolean {
  return paging.some((p) => p.page > 1 && p.totalPages != null && p.page > p.totalPages);
}

/**
 * The human span this page covers — "Showing **25–48** of 137".
 *
 * Derived from what was actually SHOWN rather than from `perPage`, so a short last page
 * says 121–137 instead of 121–144. A page that came back empty is `0–0`: an author's
 * "Showing 25–24" is worse than a zero, and the empty state is what should be on screen
 * anyway.
 */
export function shownRange(
  page: number,
  perPage: number,
  shown: number
): { from: number; to: number } {
  if (shown <= 0) return { from: 0, to: 0 };
  const from = (page - 1) * perPage + 1;
  return { from, to: from + shown - 1 };
}
