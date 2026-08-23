'use client';

// Orders — every sale, and what still needs doing about it.
//
// An order carries TWO states, not one: has it been paid for, and has it been
// sent. They are independent columns because they genuinely are, so the table
// shows both and the chips are phrased as the work rather than as the enum.
//
// It leads with **Take a sale**, because most of what this audience sells is
// sold in the room. An order arriving from a website is one way in, not the way.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Button, Card, EmptyState, SearchInput } from '@wizeworks/silicaui-react';
import { faBagShopping, faCashRegister } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useOrders, type Order, type OrderSortKey, type SortDirection } from './data';
import { FILTERS, emptyAdvice, targetFor, type FilterValue } from './orders-list-filters';
import { OrdersTable } from './orders-table';

export function OrdersListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');
  // Newest first: an orders list is read from the top, and the top is today.
  const [sort, setSort] = useState<{ key: OrderSortKey; dir: SortDirection }>({
    key: 'placedAt',
    dir: 'desc',
  });

  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  // How many rows the current window has grown to. "Load more" raises this;
  // anything that changes WHICH rows match resets it.
  const [take, setTake] = useState<number>(50);

  const active = FILTERS.find((entry) => entry.value === filter) ?? FILTERS[0];
  const skip = (page - 1) * pageSize;
  const filtered = filter !== 'all' || search.trim() !== '';

  const { data, isLoading, isFetching, dataUpdatedAt, error, refetch } = useOrders({
    q: search.trim(),
    status: active.status,
    paymentStatus: active.paymentStatus,
    sortBy: sort.key,
    order: sort.dir,
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const total = data?.total;

  /** Anything that changes which rows match returns to the first window —
   *  staying on page 5 of a result set that now has two pages shows nothing. */
  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  const toggleSort = (key: OrderSortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : // Both default to descending, because both useful questions are
          // "the most" — the newest orders and the biggest ones.
          { key, dir: 'desc' }
    );
    resetWindow();
  };

  const takeASale = () => {
    ctx.open('commerce.sale.new', {}, { target: 'tab' });
  };

  return (
    // Surfaces, not one slab: the pane is base-200, the toolbar and table are
    // base-100 cards lifted onto it.
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Order list controls"
        search={
          /* The width has to sit on a WRAPPER: SearchInput forwards className to
            its inner <input>, so a sizing class aimed at the control never
            reaches the element that actually lays out. */
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search orders"
              placeholder="Order number or customer…"
              value={search}
              onValueChange={(next) => {
                setSearch(next);
                resetWindow();
              }}
            />
          </div>
        }
        filters={[
          {
            label: 'Show',
            value: filter,
            onValueChange: (next) => {
              setFilter((next as FilterValue | null) ?? 'all');
              resetWindow();
            },
            options: FILTERS,
          },
        ]}
        views={{
          target: '/commerce/orders',
          params: { q: search.trim(), sort: `${sort.key}:${sort.dir}` },
          onApply: (next) => {
            setSearch(next.q ?? '');
            const [key, dir] = (next.sort ?? '').split(':');
            if (key && (dir === 'asc' || dir === 'desc')) {
              setSort({ key: key as OrderSortKey, dir });
            }
            resetWindow();
          },
        }}
        primary={
          <Button color="module" size="sm" className="shrink-0" onClick={takeASale}>
            <Icon glyph={faCashRegister} className="size-4" aria-hidden />
            Take a sale
          </Button>
        }
        refresh={
          /* ALWAYS the last child of a list toolbar — see RefreshButton. */
          <RefreshButton
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      <Card className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <EmptyState
            icon={<Icon glyph={faBagShopping} className="size-6" aria-hidden />}
            title="Could not load your orders"
            description="This is a problem reaching the server. Your orders are unaffected — nothing has been lost."
          />
        ) : isLoading ? (
          <PaneWaiting label="Loading orders…" />
        ) : rows.length === 0 ? (
          // "Nothing matches" and "you have none" are different facts, and
          // telling someone to wait for their first sale when they have four
          // hundred and mistyped a name is the worse of the two mistakes.
          <EmptyState
            icon={<Icon glyph={faBagShopping} className="size-6" aria-hidden />}
            title={filtered ? 'No orders match that' : 'No orders yet'}
            description={
              filtered
                ? emptyAdvice(search.trim(), filter === 'all' ? null : active.label)
                : 'Sales show up here with what was bought and what is owed — the ones people place on your website, and the ones you take in person.'
            }
            actions={
              filtered ? undefined : (
                <Button color="module" size="sm" onClick={takeASale}>
                  <Icon glyph={faCashRegister} className="size-4" aria-hidden />
                  Take a sale
                </Button>
              )
            }
          />
        ) : (
          <OrdersTable
            rows={rows}
            sort={sort}
            onSort={toggleSort}
            onOpen={(order: Order, event) => {
              ctx.open('commerce.order.detail', { id: order.id }, { target: targetFor(event) });
            }}
          />
        )}
      </Card>

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
            three modifiers do not exist. */}
        <p className="hidden px-1 pb-1 text-sm @xl:block">
          Click to open · Shift-click alongside · Alt-click new window
        </p>
      </div>
    </div>
  );
}
