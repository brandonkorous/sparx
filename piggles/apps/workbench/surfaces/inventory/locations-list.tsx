'use client';

// LOCATIONS — every place you keep stock: a warehouse, a shop floor, a van.
//
// ── A table, like every other list ───────────────────────────────────────
//
// A location is an identity (a name and the code on its shelf labels) plus two
// facts — what kind of place it is, and where it is. Laid down a table those
// facts line up into columns you scan, and the list reads the same as every
// other list in the app rather than as its own bespoke thing. The columns
// disclose with @container: docked narrow you see the name, its code and its
// state; given room the kind and the town come back. The name cell is the one
// that GIVES (`max-w-0 w-full`), so the state badge is never the column shoved
// off the right edge.
//
// ── Every narrowing is a SERVER filter ───────────────────────────────────
//
// Search, the kind of place, "show closed", and the paging all go to the API.
// Filtering the loaded window in the browser would answer "which of my 3PLs" by
// sieving the fifty rows that happen to be in hand.
//
// ── Three empty states, three different problems ─────────────────────────
//
// Nothing matches the search or filters · nothing exists yet · the load failed.
// Telling someone to set up their first location when they have twelve and
// mistyped is the worse of the mistakes, so the narrowed case says so instead.

import { useState } from 'react';
import { Card } from '@wizeworks/silicaui-react';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { LocationsListToolbar } from './locations-list-toolbar';
import { LocationsListEmpty } from './locations-list-empty';
import { LocationsListTable } from './locations-list-table';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { locationTypeLabel, useLocations, type Location } from './locations-data';
import { RowOpenHint } from '../../components/row-open-hint';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'inventory';

const DETAIL_KEY = 'inventory.warehouses.detail';

/** Same modifier contract as every other list in the app. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** What to try when nothing matched — naming ONLY what is actually narrowing the
 *  list, so no one goes hunting for a filter they never set. */
function emptyAdvice(search: string, typeLabel: string | null, includeClosed: boolean): string {
  const parts: string[] = [];
  if (search) parts.push('Try part of a location’s name or its code.');
  if (typeLabel) parts.push(`You are only seeing “${typeLabel}” places — switch to every kind.`);
  if (!includeClosed) parts.push('Closed locations are hidden — turn them on to include those.');
  return parts.join(' ');
}

export function LocationsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [includeClosed, setIncludeClosed] = useState(false);

  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);

  const skip = (page - 1) * pageSize;

  const { data, isPending, isFetching, dataUpdatedAt, isError, refetch } = useLocations({
    q: search.trim(),
    ...(type ? { type } : {}),
    includeClosed,
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const total = data?.total;
  const typeLabel = type ? locationTypeLabel(type) : null;
  // Only an explicit search or kind filter counts as "narrowed". "Show closed"
  // is OFF by default, so treating that default as a narrowing would show a
  // brand-new account "Nothing matches that" instead of a first-run create
  // prompt — the empty-account case must reach the CTA, not the search advice.
  const narrowed = search.trim() !== '' || type !== '';

  /** Anything that changes which rows match returns to the first window —
   *  staying on page 5 of a set that now has two shows nothing. */
  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  const openNew = (event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open(DETAIL_KEY, { id: 'new' }, { target: targetFor(event) });
  };

  const open = (location: Location, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open(DETAIL_KEY, { id: location.id }, { target: targetFor(event) });
  };

  const body = () => {
    if (isError || isPending || rows.length === 0) {
      return (
        <LocationsListEmpty
          module={MODULE}
          isError={isError}
          isPending={isPending}
          narrowed={narrowed}
          advice={emptyAdvice(search.trim(), typeLabel, includeClosed)}
          includeClosed={includeClosed}
          onRetry={() => {
            void refetch();
          }}
          onNew={() => {
            openNew({ shiftKey: false, altKey: false });
          }}
        />
      );
    }
    return <LocationsListTable rows={rows} onOpen={open} />;
  };

  return (
    <div className={PANE_SHELL}>
      {/* The toolbar does NOT wrap: a second line shoves the grid down and
          reflows as you type. Things give way instead — the kind picker shrinks,
          the "show closed" toggle sheds its label below @2xl — and the search box
          absorbs whatever is left. The primary action carries `ml-auto`. */}
      <LocationsListToolbar
        search={search}
        onSearch={(next) => {
          setSearch(next);
          resetWindow();
        }}
        type={type}
        onType={(next) => {
          setType(next);
          resetWindow();
        }}
        includeClosed={includeClosed}
        onIncludeClosed={(next) => {
          setIncludeClosed(next);
          resetWindow();
        }}
        onNew={openNew}
        isFetching={isFetching}
        updatedAt={data ? dataUpdatedAt : undefined}
        onRefresh={() => {
          void refetch();
        }}
      />

      {/* Full width — the base-100 card lifts the rows off the recessed pane.
          Matches the house list convention: the table fills the pane. */}
      <Card className="min-h-0 flex-1 overflow-y-auto">{body()}</Card>

      <div className="shrink-0">
        <ListPagination
          shown={rows.length}
          firstRow={rows.length === 0 ? 0 : skip + 1}
          total={total}
          page={page}
          pageSize={pageSize}
          canLoadMore={take < MAX_TAKE}
          busy={isFetching}
          onLoadMore={() => {
            setTake((current) => Math.min(current + pageSize, MAX_TAKE));
          }}
          onPageChange={(next) => {
            setPage(next);
            setTake(pageSize);
          }}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
            setTake(size);
          }}
        />
        {rows.length > 0 ? <RowOpenHint /> : null}
      </div>
    </div>
  );
}
