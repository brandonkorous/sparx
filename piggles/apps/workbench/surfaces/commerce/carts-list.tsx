'use client';

// Carts: orders someone started but has not paid for. A read view (shoppers fill
// carts, never staff), opened to answer "who nearly bought, and didn't?". Each
// filter chip maps to ONE server filter, so the screen is always one server answer.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Card, EmptyState } from '@wizeworks/silicaui-react';
import { faCartShopping } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useCarts, type CartFilter, type CartRow } from './carts-data';
import { CartsTable, cartOpenTarget } from './carts-list-table';
import { RowOpenHint } from '../../components/row-open-hint';

const FILTERS = [
  { value: 'active', label: 'In progress' },
  { value: 'abandoned', label: 'Walked away' },
  { value: 'recovered', label: 'Came back' },
] as const satisfies readonly { value: CartFilter; label: string }[];

const EMPTY_BODY: Record<CartFilter, string> = {
  active: 'Nobody is filling a basket right now. They appear here as shoppers add things.',
  abandoned:
    'Nothing left behind at the moment. When a shopper fills a basket and leaves without paying, it lands here so you can follow it up.',
  recovered: 'None came back yet. These are the ones a shopper returned to and finished.',
};

function CartsBody({
  carts,
  filter,
  rows,
  onOpen,
}: {
  carts: ReturnType<typeof useCarts>;
  filter: CartFilter;
  rows: CartRow[];
  onOpen: (row: CartRow, event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  if (carts.error) {
    return (
      <PaneLoadError
        icon={<Icon glyph={faCartShopping} className="size-6" aria-hidden />}
        title="Could not load the baskets"
        description="This is a problem reaching the server. The baskets themselves are unaffected. Nothing has been lost."
        error={carts.error}
      />
    );
  }
  if (carts.isLoading) return <PaneWaiting label="Loading baskets…" />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Icon glyph={faCartShopping} className="size-6" aria-hidden />}
        title="Nothing here"
        description={EMPTY_BODY[filter]}
      />
    );
  }
  return <CartsTable rows={rows} onOpen={onOpen} />;
}

interface CartWindow {
  page: number;
  pageSize: PageSize;
  take: number;
  setPage: (page: number) => void;
  setPageSize: (size: PageSize) => void;
  setTake: (take: number | ((current: number) => number)) => void;
}

function CartsPager({
  win,
  rowCount,
  total,
  busy,
}: {
  win: CartWindow;
  rowCount: number;
  total: number | undefined;
  busy: boolean;
}) {
  const { page, pageSize, take, setPage, setPageSize, setTake } = win;
  return (
    <div className="shrink-0">
      <ListPagination
        shown={rowCount}
        firstRow={rowCount === 0 ? 0 : (page - 1) * pageSize + 1}
        total={total}
        page={page}
        pageSize={pageSize}
        canLoadMore={take < MAX_TAKE}
        busy={busy}
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
      {rowCount > 0 ? <RowOpenHint /> : null}
    </div>
  );
}

function CartsToolbar({
  carts,
  filter,
  onFilter,
}: {
  carts: ReturnType<typeof useCarts>;
  filter: CartFilter;
  onFilter: (next: CartFilter) => void;
}) {
  const { data, isFetching, dataUpdatedAt, refetch } = carts;
  return (
    <PaneToolbar
      label="Baskets left behind controls"
      filters={[
        {
          label: 'Show',
          key: 'filter',
          value: filter,
          onValueChange: (next) => {
            onFilter((next as CartFilter | null) ?? 'abandoned');
          },
          options: FILTERS,
        },
      ]}
      // Everything narrowing this list rides `filters`, so the bar composes the
      // whole snapshot itself.
      views={{ target: '/commerce/carts' }}
      refresh={
        <RefreshButton
          isFetching={isFetching}
          updatedAt={data ? dataUpdatedAt : undefined}
          onRefresh={() => {
            void refetch();
          }}
        />
      }
    />
  );
}

export function CartsListSurface({ ctx }: { ctx: SurfaceContext }) {
  // Recovering an abandoned cart is the whole point, so that is where the list starts.
  const [filter, setFilter] = useState<CartFilter>('abandoned');
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);
  const win: CartWindow = { page, pageSize, take, setPage, setPageSize, setTake };
  const carts = useCarts({ filter, take, skip: (page - 1) * pageSize });
  const rows = carts.data?.items ?? [];

  return (
    <div className={PANE_SHELL}>
      <CartsToolbar
        carts={carts}
        filter={filter}
        onFilter={(next) => {
          setFilter(next);
          setPage(1);
          setTake(pageSize);
        }}
      />
      <Card className="min-h-0 flex-1 overflow-y-auto">
        <CartsBody
          carts={carts}
          filter={filter}
          rows={rows}
          onOpen={(row, event) => {
            ctx.open('commerce.cart.detail', { id: row.id }, { target: cartOpenTarget(event) });
          }}
        />
      </Card>
      <CartsPager
        win={win}
        rowCount={rows.length}
        total={carts.data?.total}
        busy={carts.isFetching}
      />
    </div>
  );
}
