'use client';

// STOCK — how much of each thing you have right now, everywhere you keep it.
//
// This file owns the pane: its filters, its window over the data, and its
// toolbar. The table is stock-list-table.tsx and the several kinds of nothing
// are stock-list-empty.tsx.
//
// ── Every narrowing is a SERVER filter ───────────────────────────────────
//
// Search, location, "running low", the sort and the paging all go to the API.
// Sorting the loaded window in the browser sorts ONE page and presents it as the
// answer, so "what is closest to running out" would return the scarcest of the
// fifty rows that happen to be in hand.
//
// ── Four empty states, because they are four different problems ──────────
// This list can only see what has a level row, and a level row appears only when
// somebody counts something — so a bakery typing "rye", the exact name of a
// product on her own shop page, was told to try part of a product name. When the
// search is the ONLY thing narrowing the list we ask the catalog too, which is
// what `searchOnly` decides. The states themselves are in stock-list-empty.

import { useMemo, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Card, EmptyState } from '@wizeworks/silicaui-react';
import { faBoxes } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import {
  useCatalogMatches,
  useStockLevels,
  useStockLocations,
  type SortDirection,
  type StockLevel,
  type StockSortKey,
} from './data';
import { RowOpenHint } from '../../components/row-open-hint';
import { StockListEmpty } from './stock-list-empty';
import { StockListTable } from './stock-list-table';
import { StockListToolbar, parseSort } from './stock-list-toolbar';

/** Same modifier contract as every other list in the app. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function StockListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  // Most recently changed first: opened cold, the useful question is "what
  // moved". Switching to "To sell" answers "what is nearly gone" instead.
  const [sort, setSort] = useState<{ key: StockSortKey; dir: SortDirection }>({
    key: 'updatedAt',
    dir: 'desc',
  });

  // The half of this list's state the toolbar does not already hold. The
  // location filter rides the `filters` slot, so a saved view picks it up
  // without being told.
  const viewParams = useMemo(
    () => ({ q: search.trim(), low: lowOnly ? '1' : '', sort: `${sort.key}:${sort.dir}` }),
    [search, lowOnly, sort]
  );

  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  // How wide the current window has grown. "Load more" raises this; anything
  // that changes WHICH rows match resets it.
  const [take, setTake] = useState<number>(50);

  const skip = (page - 1) * pageSize;
  const locations = useStockLocations();
  const activeLocations = (locations.data?.items ?? []).filter((location) => location.isActive);
  const locationName = activeLocations.find((location) => location.id === locationId)?.name ?? null;

  const { data, isLoading, isFetching, dataUpdatedAt, isError, refetch } = useStockLevels({
    q: search.trim(),
    ...(locationId ? { warehouseId: locationId } : {}),
    lowStockOnly: lowOnly,
    sortBy: sort.key,
    order: sort.dir,
    take,
    skip,
  });

  const rowCount = data?.items.length ?? 0;
  // Only askable when the search is the only thing narrowing the list: with a
  // location filter on, an empty result means "not here", and the product could
  // be sitting counted at the place next door.
  const searchOnly = search.trim() !== '' && locationId === '' && !lowOnly;
  const catalog = useCatalogMatches(
    search.trim(),
    searchOnly && !isLoading && !isError && rowCount === 0
  );

  const rows = data?.items ?? [];
  const total = data?.total;
  const narrowed = search.trim() !== '' || locationId !== '' || lowOnly;

  /** Anything that changes which rows match returns to the first window —
   *  staying on page 5 of a result set that now has two pages shows nothing. */
  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  const toggleSort = (key: StockSortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : // Quantities open smallest-first ("what is nearly gone"), timestamps
          // newest-first, names A–Z. Each is the question people actually ask.
          { key, dir: key === 'updatedAt' ? 'desc' : 'asc' }
    );
    resetWindow();
  };

  const open = (level: StockLevel, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('inventory.stock.item', { variantId: level.variantId }, { target: targetFor(event) });
  };

  /** Always beside, never in place: the whole point of the explanation is to
   *  read it while still looking at the number it explains. */
  const explain = (level: StockLevel) => {
    ctx.open(
      'inventory.stock.provenance',
      { variantId: level.variantId, warehouseId: level.warehouseId },
      { target: 'beside' }
    );
  };

  const body = () => {
    // A failed load REPLACES the table. Rendering an empty grid under live
    // filters invites someone to conclude they have no stock.
    if (isError) {
      return (
        <EmptyState
          icon={<Icon glyph={faBoxes} className="size-6" aria-hidden />}
          title="Could not load your stock"
          description="This is a problem reaching the server. Your stock is unaffected — the numbers just could not be read just now."
        />
      );
    }

    if (isLoading) {
      return <PaneWaiting label="Loading stock…" />;
    }

    if (rows.length === 0) {
      return (
        <StockListEmpty
          ctx={ctx}
          search={search}
          locationName={locationName}
          lowOnly={lowOnly}
          narrowed={narrowed}
          catalogMatches={catalog.data?.items ?? []}
          checkingCatalog={catalog.isFetching}
        />
      );
    }

    return (
      <StockListTable
        rows={rows}
        sort={sort}
        onSort={toggleSort}
        onOpen={open}
        onExplain={explain}
      />
    );
  };

  return (
    <div className={PANE_SHELL}>
      <StockListToolbar
        search={search}
        onSearch={(next) => {
          setSearch(next);
          resetWindow();
        }}
        locationId={locationId}
        onLocation={(next) => {
          setLocationId(next);
          resetWindow();
        }}
        locations={activeLocations}
        lowOnly={lowOnly}
        onLowOnly={(next) => {
          setLowOnly(next);
          resetWindow();
        }}
        viewParams={viewParams}
        onApplyView={(next) => {
          setSearch(next.q ?? '');
          setLowOnly(next.low === '1');
          const parsed = parseSort(next.sort);
          if (parsed) setSort(parsed);
          resetWindow();
        }}
        isFetching={isFetching}
        updatedAt={data ? dataUpdatedAt : undefined}
        onRefresh={() => {
          void refetch();
        }}
      />

      {/* Full width — matches the house list convention: the table fills the pane. */}
      <Card className="min-h-0 flex-1 overflow-y-auto">{body()}</Card>

      {/* Sits on the pane, not in the card — it describes the table rather than
          being part of it, which is what the recessed surface says. */}
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
            // A jump REPLACES the window, so growth from "load more" belongs to
            // the window you just left, not the one you land on.
            setTake(pageSize);
          }}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
            setTake(size);
          }}
        />
        {/* Only where there is a pointer to do them with — on the stack these
            three modifiers do not exist — and only when there is something to
            click, since advice about opening rows reads as an instruction when
            the answer to the search is that there are none. */}
        {rows.length > 0 ? <RowOpenHint /> : null}
      </div>
    </div>
  );
}
