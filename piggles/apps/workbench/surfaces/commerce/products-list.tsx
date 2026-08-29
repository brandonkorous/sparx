'use client';

// Products — everything this business sells.
//
// Three things shape this beyond a plain table.
//
// FIRST: the question a catalog list is opened to answer is almost never "show me
// everything". It is "what is not on sale yet" or "what did I retire". So the
// chips are those questions, each mapping to exactly ONE server filter — no chip
// means "these two statuses, sort of".
//
// SECOND: a product's price is a RANGE, not a number, because the price lives on
// its versions and they can differ. Collapsing it to the lowest one tells a
// half-truth on the one column where the number matters, so the cell says
// "$18.00 – $24.00" when that is the truth.
//
// THIRD: several rows can be chosen and acted on together. This is the first
// list a new owner meets and the first thing many of them want is "not these" —
// emptying a starter catalogue used to be fifteen rounds of open, scroll,
// confirm, wait. The selection model is `useListSelection`, deliberately shared,
// because every list pane wants this and bolting it onto Products alone is how
// four different half-versions of it get written.
//
// This file owns the state and the routing; the parts are the sibling
// products-list-* files.

import { useState } from 'react';
import { Card } from '@wizeworks/silicaui-react';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PANE_SHELL } from '../../components/pane-toolbar';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { RowOpenHint } from '../../components/row-open-hint';
import { Icon } from '@piggles/ui';
import { faBox } from '@fortawesome/pro-solid-svg-icons';
import { useListSelection } from '../../lib/workbench/selection';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  unfindableProductCount,
  usePaymentsReady,
  useProducts,
  useSearchStatus,
  type ProductRow,
  type ProductSortKey,
  type SortDirection,
} from './products-data';
import { FILTERS, targetFor, type FilterValue, type Modifiers } from './products-list-shared';
import { ProductsListToolbar } from './products-list-toolbar';
import { ProductsListNotices } from './products-list-notices';
import { ProductsListEmpty } from './products-list-empty';
import { ProductsListTable } from './products-list-table';
import { ProductsBulkActions } from './products-bulk-actions';

export function ProductsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');
  // Newest-changed first: a catalog is opened at whatever you were last working
  // on far more often than at the letter A.
  const [sort, setSort] = useState<{ key: ProductSortKey; dir: SortDirection }>({
    key: 'updatedAt',
    dir: 'desc',
  });

  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  // How many rows the current window has grown to. "Load more" raises this;
  // anything that changes WHICH rows match resets it.
  const [take, setTake] = useState<number>(50);

  const active = FILTERS.find((entry) => entry.value === filter) ?? FILTERS[0];
  const skip = (page - 1) * pageSize;
  const narrowed = filter !== 'all' || search.trim() !== '';

  const { data, isLoading, isFetching, dataUpdatedAt, error, refetch } = useProducts({
    q: search.trim(),
    ...(active.status ? { status: active.status } : {}),
    ...(active.includeArchived ? { includeArchived: true } : {}),
    sortBy: sort.key,
    order: sort.dir,
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const selection = useListSelection<ProductRow>(rows, { keyOf: (row) => row.id });

  // Is the shop actually findable? The public listing reads the SEARCH INDEX,
  // not this table, so a product missing from it renders "No products found" to
  // a visitor searching for it by name while this screen shows a full, healthy
  // list.
  //
  // THE GAP, not the total. This read "only none at all is reported", on the
  // reasoning that a count which merely disagrees could be a worker a few seconds
  // behind and crying wolf would train people to ignore it. The reasoning is
  // right and the discriminator was wrong: it made "the indexer is two seconds
  // late" and "four products have been missing since Tuesday" the same signal, so
  // it reported neither. Four of a sixteen-product catalog were unfindable for
  // six days while this screen said nothing (issue 318). The server now excludes
  // anything changed inside a grace window, so lag is not counted and a real
  // shortfall is. `null` means the check itself could not run — said nothing
  // about, never rendered as zero.
  const searchStatus = useSearchStatus();
  const unfindable = unfindableProductCount(searchStatus.data);
  const sellableCount = rows.filter((row) => row.status === 'active').length;
  // The OTHER way a live shop quietly sells nothing, and the crueller of the
  // two: the customer is turned away at the last step, after choosing, typing an
  // address and picking how to collect it.
  const paymentsReady = usePaymentsReady();
  /** A refetch failed but the previous window is still on screen. */
  const staleAfterFailure = Boolean(error) && rows.length > 0;

  /** Refresh means everything the pane is showing, not just the rows. The
   *  notices above the list are read off their own queries, so refetching the
   *  products alone left "Searching your shop won't find 16 of your products"
   *  standing over a list of 7 while the control reported it had updated —
   *  which teaches her that Refresh does not refresh (issue 325). */
  const refreshPane = () => {
    void refetch();
    void searchStatus.refetch();
  };

  /** Anything that changes which rows match returns to the first window and
   *  drops the selection — chosen rows that no longer match would act
   *  invisibly. Paging KEEPS it: same result set, different window. */
  const onNarrow = () => {
    setPage(1);
    setTake(pageSize);
    selection.clear();
  };

  const toggleSort = (key: ProductSortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : // Names read A→Z; dates and prices are asked about as "the most".
          { key, dir: key === 'title' ? 'asc' : 'desc' }
    );
    setPage(1);
    setTake(pageSize);
  };

  const open = (product: ProductRow, event: Modifiers) => {
    ctx.open('commerce.product.detail', { id: product.id }, { target: targetFor(event) });
  };

  const create = (event: Modifiers) => {
    ctx.open('commerce.product.detail', { id: 'new' }, { target: targetFor(event) });
  };

  const table = () => {
    if (error && !staleAfterFailure) {
      // A failed load REPLACES the table rather than rendering an empty one:
      // "No products yet" over a connection failure is a lie about the catalog,
      // and the worst possible one to tell someone.
      return (
        <PaneLoadError
          icon={<Icon glyph={faBox} className="size-6" aria-hidden />}
          title="Could not load your products"
          description="This is a problem reaching the server. Your catalog is unaffected — nothing has been lost."
          onRetry={() => {
            void refetch();
          }}
        />
      );
    }
    if (isLoading) return <PaneWaiting label="Loading products…" />;
    if (rows.length === 0) {
      return (
        <ProductsListEmpty
          narrowed={narrowed}
          search={search.trim()}
          filterLabel={filter === 'all' ? null : active.label}
          onCreate={create}
        />
      );
    }
    return (
      <ProductsListTable
        rows={rows}
        sort={sort}
        onSort={toggleSort}
        onOpen={open}
        selection={selection}
      />
    );
  };

  return (
    // Surfaces, not one slab: the pane is base-200, the toolbar and table are
    // base-100 cards lifted onto it.
    <div className={PANE_SHELL}>
      {/* The toolbar goes THROUGH the bulk bar rather than above it: they share
          one grid cell, so choosing a row swaps what the strip shows without
          moving the table under the pointer. */}
      <ProductsBulkActions
        selection={selection}
        toolbar={
          <ProductsListToolbar
            search={search}
            onSearch={(next) => {
              setSearch(next);
              onNarrow();
            }}
            filter={filter}
            onFilter={(next) => {
              setFilter(next);
              onNarrow();
            }}
            sort={sort}
            onSort={setSort}
            onCreate={create}
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={refreshPane}
          />
        }
      />

      <Card className="min-h-0 flex-1 overflow-y-auto">
        <ProductsListNotices
          ctx={ctx}
          cannotBePaid={paymentsReady === false && sellableCount > 0}
          unfindableCount={unfindable !== null && unfindable > 0 ? unfindable : null}
          staleAfterFailure={staleAfterFailure}
          onRetry={() => {
            void refetch();
          }}
        />
        {table()}
      </Card>

      {/* Sits on the pane, not in the card — it describes the table rather than
          being part of it, which is what the recessed surface says. */}
      <div className="shrink-0">
        <ListPagination
          shown={rows.length}
          firstRow={rows.length === 0 ? 0 : skip + 1}
          total={data?.total}
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
            three modifiers do not exist. */}
        <RowOpenHint />
      </div>
    </div>
  );
}
