'use client';

// Paging a long list — walk forward, or jump.
//
// "Load more" alone is the pattern that makes a 300-row list miserable: it can
// only ever go forwards, one bite at a time, so reaching the end of a long list
// means clicking the same button six times. "Numbered pages" alone loses your
// place every time and turns a downward scan into a page-flip.
//
// So this is both, and they are not in conflict once each has a clear job:
//   • Load more EXTENDS the window you are reading — the rows you already have
//     stay put, more appear below, your scroll position survives.
//   • The pager MOVES the window somewhere else entirely — page 5 of 5 is one
//     tap, which is the thing load-more cannot do at all.
//
// The size picker is the third answer to the same complaint: reading 300 rows
// 25 at a time is twelve interactions, and at 100 at a time it is three.
//
// TWO MODES, because the platform has two kinds of list and one control:
//
//   • COUNTED (pass `total`) — an offset endpoint that knows how many rows
//     match. Renders numbered pages: skip/take, jump anywhere. What
//     /v1/invoicing/documents supports.
//   • CURSOR (omit `total`, pass `hasMore` + `onOlder`/`onNewer`) — a keyset
//     feed with no count, walked a window at a time. What /v1/activity is: an
//     append-only log where offset paging would re-show rows a reader already
//     passed, because new ones keep arriving at the top while they read.
//
// One component rather than two so both panels speak the same language — the
// same range readout, the same size picker, in the same place. The pager is the
// only part that differs, and it differs because the DATA differs, not because
// the two screens were built by different hands. A cursor feed given fake page
// numbers would look more consistent and behave worse.

import { Button, NativeSelect, Pagination, Text } from '@wizeworks/silicaui-react';
import { faChevronLeft, faChevronRight } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

/** Rows per window. The server caps a single request at 250 (see MAX_TAKE). */
export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

/** api-rest rejects `take` over 250 rather than clamping, so the client must
 *  never ask for more — this bounds how far "load more" can extend a window. */
export const MAX_TAKE = 250;

interface ListPaginationProps {
  /** Rows currently on screen. */
  shown: number;
  /** Index of the first row on screen, 1-based, for the range readout. */
  firstRow: number;
  /** Total matching the current filters. Undefined = the server didn't say,
   *  which is also what puts this control in cursor mode. */
  total?: number | undefined;
  page: number;
  pageSize: PageSize;
  /** False once the window has grown to the server's per-request ceiling. */
  canLoadMore?: boolean;
  /** A fetch is in flight. Locks the controls so a second click can't race the
   *  first — two rapid "load more" taps would otherwise fire two windows and
   *  render whichever landed last, which is not necessarily the wider one. */
  busy: boolean;
  onLoadMore?: () => void;
  onPageChange?: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;

  /* ── Cursor mode ──────────────────────────────────────────────────────── */

  /** Whether older rows exist. Required in cursor mode, where `total` cannot
   *  answer it. Derived by the caller — typically "the window came back full". */
  hasMore?: boolean;
  /** Step to the next window of older rows. Presence of this selects cursor mode. */
  onOlder?: () => void;
  /** Back toward the newest window. Omit/undefined disables the control. */
  onNewer?: () => void;
}

export function ListPagination({
  shown,
  firstRow,
  total,
  page,
  pageSize,
  canLoadMore = false,
  busy,
  onLoadMore,
  onPageChange,
  onPageSizeChange,
  hasMore = false,
  onOlder,
  onNewer,
}: ListPaginationProps) {
  const cursorMode = onOlder !== undefined;
  const pageCount = total === undefined ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const lastRow = firstRow + shown - 1;
  // Undefined total is reported as unknown, never as zero — "1–50 of 0" would
  // be a lie the moment an endpoint stops sending a count.
  const range =
    shown === 0
      ? 'Nothing to show'
      : total === undefined
        ? `Showing ${String(firstRow)}–${String(lastRow)}`
        : `Showing ${String(firstRow)}–${String(lastRow)} of ${String(total)}`;

  // `shown > 0` guards the empty case: with no rows, lastRow is firstRow - 1,
  // so an empty result set reported `-1 < 0` and offered "Load 1 more" beside
  // the words "Nothing to show".
  const moreAvailable = total !== undefined && shown > 0 && lastRow < total;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1 py-2">
      <Text className="text-sm">{range}</Text>

      {moreAvailable && canLoadMore ? (
        <Button color="module" variant="soft" size="sm" disabled={busy} onClick={onLoadMore}>
          {busy ? 'Loading…' : `Load ${String(Math.min(pageSize, total - lastRow))} more`}
        </Button>
      ) : null}

      <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
        {/* Cursor mode: step through time instead of jumping to a page number.
            Both controls always render once the feed is walkable, disabled at
            the ends — a button that appears and vanishes as you move makes the
            row reflow under the pointer you are about to click with. */}
        {cursorMode ? (
          <div className="flex items-center gap-1">
            <Button
              color="module"
              variant="ghost"
              size="sm"
              disabled={busy || !onNewer}
              onClick={onNewer}
            >
              <Icon glyph={faChevronLeft} className="size-4" aria-hidden />
              Newer
            </Button>
            <Button
              color="module"
              variant="ghost"
              size="sm"
              disabled={busy || !hasMore}
              onClick={onOlder}
            >
              Older
              <Icon glyph={faChevronRight} className="size-4" aria-hidden />
            </Button>
          </div>
        ) : null}

        {/* Only worth showing once there is somewhere to jump TO. */}
        {!cursorMode && pageCount > 1 ? (
          <Pagination
            color="module"
            size="sm"
            page={page}
            count={pageCount}
            // 0 siblings keeps the control to ~5 targets, which is what lets it
            // survive a 320px pane instead of wrapping into a second row of
            // numbers. The ellipsis still reaches first/last in one tap.
            siblingCount={0}
            boundaryCount={1}
            onChange={onPageChange}
          />
        ) : null}

        <label className="flex items-center gap-1.5">
          <span className="sr-only">Rows per page</span>
          <NativeSelect
            size="sm"
            value={String(pageSize)}
            aria-label="Rows per page"
            onChange={(event) => {
              onPageSizeChange(Number(event.target.value) as PageSize);
            }}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>
    </div>
  );
}
