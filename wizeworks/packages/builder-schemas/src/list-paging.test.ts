import { describe, expect, it } from 'vitest';

import {
  pageFrom,
  pageOutOfRange,
  pagingParamFor,
  shownRange,
  totalPagesFor,
  type ListPaging,
} from './list-paging';

// These four functions are the whole answer to "does `?page=2` actually work". They used
// to live in `wizeworks/apps/site/lib/silica-data.ts`, where nothing could test them — no app in
// this repo has a test script — while THREE separate consumers depended on agreeing with
// them: the route that fetches the slice, the `site.pagination` core that renders the
// links, and the bound `…From`/`…To` refs a template puts in "Showing 25–48 of 137".
//
// The failure mode is not a crash. It is a Next link to a page the fetch already knows is
// empty, or a "Showing 25–48" over 24 rows, on a live storefront, silently.

describe('pageFrom — a page number arrives from the open internet', () => {
  it('reads a real page number', () => {
    expect(pageFrom({ page: '2' }, 'page')).toBe(2);
    expect(pageFrom({ page: '137' }, 'page')).toBe(137);
  });

  it('falls back to page one for everything that is not a positive integer', () => {
    // Each of these is somebody's typo, somebody's stale bookmark, or somebody's crawler.
    // The first page costs nothing to serve; an error page is a 500 in a search index.
    for (const raw of ['banana', '0', '-3', '', ' ', 'NaN', 'Infinity', '1e9999']) {
      expect(pageFrom({ page: raw }, 'page')).toBeGreaterThanOrEqual(1);
    }
    expect(pageFrom({ page: 'banana' }, 'page')).toBe(1);
    expect(pageFrom({ page: '0' }, 'page')).toBe(1);
    expect(pageFrom({ page: '-3' }, 'page')).toBe(1);
  });

  it('treats a missing param, and missing params entirely, as page one', () => {
    expect(pageFrom({}, 'page')).toBe(1);
    expect(pageFrom(undefined, 'page')).toBe(1);
  });

  it('takes the FIRST value when the param repeats', () => {
    // `?page=2&page=3` is what a duplicated form field or a proxy produces, and Next
    // hands it over as `string[]`. Picking one deterministically beats `NaN`.
    expect(pageFrom({ page: ['2', '3'] }, 'page')).toBe(2);
    expect(pageFrom({ page: [] }, 'page')).toBe(1);
  });

  it('reads a trailing-garbage number the way a person meant it', () => {
    // `parseInt` semantics, stated on purpose: `?page=2x` is a truncated copy-paste and
    // page 2 is what they were reaching for.
    expect(pageFrom({ page: '2x' }, 'page')).toBe(2);
  });

  it('only reads the param it was asked for', () => {
    expect(pageFrom({ 'page-blog-post': '4' }, 'page')).toBe(1);
    expect(pageFrom({ 'page-blog-post': '4' }, 'page-blog-post')).toBe(4);
  });
});

describe('pagingParamFor — one list gets `?page`, several get their own', () => {
  it('uses the bare `page` when the list is the only paginated one', () => {
    // Nearly always the case, and the one that matters: `?page=2` is what a reader
    // bookmarks and a search engine crawls.
    expect(pagingParamFor('commerce.product', true)).toBe('page');
    expect(pagingParamFor('cms.blog_post', true)).toBe('page');
  });

  it('suffixes with the source when a page carries two paginated lists', () => {
    // A product grid and a journal index on one page cannot share a parameter without
    // moving together, which is the bug this exists to prevent.
    expect(pagingParamFor('commerce.product', false)).toBe('page-product');
    expect(pagingParamFor('cms.blog_post', false)).toBe('page-blog-post');
  });

  it('produces a URL-safe name — underscores become hyphens', () => {
    expect(pagingParamFor('cms.case_study_entry', false)).toBe('page-case-study-entry');
  });

  it('survives a key with no dot in it', () => {
    expect(pagingParamFor('product', false)).toBe('page-product');
  });
});

describe('totalPagesFor — how far the catalog goes', () => {
  it('divides and rounds up', () => {
    expect(totalPagesFor(137, 24)).toBe(6);
    expect(totalPagesFor(48, 24)).toBe(2);
    expect(totalPagesFor(49, 24)).toBe(3);
  });

  it('is at least ONE page, even with nothing in the collection', () => {
    // "Page 1 of 0" is the shape that renders a disabled Next beside a disabled Previous
    // and reads as broken rather than empty.
    expect(totalPagesFor(0, 24)).toBe(1);
  });

  it('returns null when the source cannot count', () => {
    // The CMS entries endpoint only counts when asked by page number, so a cursor-walked
    // list genuinely has no total — and the pager then says "Next", not "of 9".
    expect(totalPagesFor(null, 24)).toBeNull();
    expect(totalPagesFor(undefined, 24)).toBeNull();
  });

  it('refuses to divide by a nonsense page size instead of returning Infinity', () => {
    expect(totalPagesFor(137, 0)).toBeNull();
    expect(totalPagesFor(137, -1)).toBeNull();
  });
});

describe('shownRange — the "Showing 25–48 of 137" line', () => {
  it('counts from the right offset on a later page', () => {
    expect(shownRange(1, 24, 24)).toEqual({ from: 1, to: 24 });
    expect(shownRange(2, 24, 24)).toEqual({ from: 25, to: 48 });
    expect(shownRange(6, 24, 17)).toEqual({ from: 121, to: 137 });
  });

  it('derives the end from what was SHOWN, not from the page size', () => {
    // The short last page. Reading `to` off `perPage` claims 121–144 of 137, which is the
    // kind of wrong that survives review because every earlier page looks right.
    expect(shownRange(6, 24, 17).to).toBe(137);
  });

  it('is 0–0 when the page came back empty', () => {
    // A page past the end, or an emptied collection. "Showing 25–24" is worse than a zero,
    // and the empty state is what belongs on screen anyway.
    expect(shownRange(2, 24, 0)).toEqual({ from: 0, to: 0 });
    expect(shownRange(99, 24, 0)).toEqual({ from: 0, to: 0 });
  });

  it('handles a single record', () => {
    expect(shownRange(1, 24, 1)).toEqual({ from: 1, to: 1 });
  });
});

describe('the pager and the fetch agree — the round trip', () => {
  // The claim itself: a 137-product catalog is fully reachable, every page reports a
  // truthful span, and the last page does NOT offer a Next.
  const TOTAL = 137;
  const PER_PAGE = 24;

  it('walks the whole catalog with no gap and no overlap', () => {
    const pages = totalPagesFor(TOTAL, PER_PAGE)!;
    expect(pages).toBe(6);

    let expectedNext = 1;
    for (let page = 1; page <= pages; page++) {
      const shown = Math.min(PER_PAGE, TOTAL - (page - 1) * PER_PAGE);
      const { from, to } = shownRange(page, PER_PAGE, shown);
      expect(from).toBe(expectedNext);
      expect(to - from + 1).toBe(shown);
      expectedNext = to + 1;
      // `hasMore`, as the storefront computes it.
      expect(page < pages).toBe(page !== pages);
    }
    // Nothing dropped, nothing double-counted.
    expect(expectedNext - 1).toBe(TOTAL);
  });

  it('a `?page=2` URL resolves to the second slice, end to end', () => {
    const param = pagingParamFor('commerce.product', true);
    const page = pageFrom({ [param]: '2' }, param);
    expect(param).toBe('page');
    expect(page).toBe(2);
    expect(shownRange(page, PER_PAGE, PER_PAGE)).toEqual({ from: 25, to: 48 });
  });
});

// The guard that stops an out-of-range page publishing a phantom record. A repeat over an
// empty collection renders its TEMPLATE once — deliberate on the canvas, and on a live
// storefront it served a card headed "Post title" with a src-less image at `/blog?page=2`.
// The fix is the HTTP one, so these cases are the contract for what counts as out of range.
describe('pageOutOfRange', () => {
  const entry = (over: Partial<ListPaging>): ListPaging => ({
    source: 'cms.blog_post',
    param: 'page',
    page: 1,
    perPage: 24,
    total: 12,
    totalPages: 1,
    hasMore: false,
    ...over,
  });

  it('is true past the last page', () => {
    expect(pageOutOfRange([entry({ page: 2 })])).toBe(true);
    expect(pageOutOfRange([entry({ page: 99 })])).toBe(true);
  });

  it('is false on the last page itself', () => {
    expect(pageOutOfRange([entry({ page: 3, totalPages: 3 })])).toBe(false);
  });

  it('never 404s page one — an empty collection is page 1 of 1, not a missing page', () => {
    expect(pageOutOfRange([entry({ page: 1, total: 0, totalPages: 1 })])).toBe(false);
  });

  it('does not guess when the source cannot count', () => {
    expect(pageOutOfRange([entry({ page: 9, total: null, totalPages: null })])).toBe(false);
  });

  it('trips on ANY list, so one out-of-range grid is enough', () => {
    expect(
      pageOutOfRange([
        entry({ source: 'commerce.product', param: 'page-product', page: 1 }),
        entry({ page: 4 }),
      ])
    ).toBe(true);
  });

  it('is false for a page with no paginated lists at all', () => {
    expect(pageOutOfRange([])).toBe(false);
  });
});
