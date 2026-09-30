'use client';

// Wholesale orders — orders placed by the businesses you supply.
//
// These are the same orders the commerce Orders list shows, narrowed to buyers
// who belong to a wholesale customer: bulk buys on agreed prices and terms rather
// than a card at checkout. Opening one shows the full order — the shared order
// detail — because an order is an order whichever door it came through.
//
// When opened from an account (`accountId` param) the list is pinned to that one
// business, with a chip saying so and a way back to all of them.
//
// ENTERING ONE. A shop phones an order through, and this screen had nowhere to
// type it — no button in the toolbar, no `+` on its nav row, and an empty state
// that described orders arriving on their own. There were 3 wholesale orders on
// the whole machine and 0 for the business being walked, which is what a screen
// with no way in looks like from the data (issue 748).
//
// It sends her to the till, which is the console's one order-entry screen and
// already resolves a wholesale customer's agreed prices (issue 737). That is a
// COMMERCE surface reached from a B2B one, which is safe by construction:
// `requiredModules('b2b')` is `['commerce']`, so wherever this pane exists the
// till does too.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Badge, Button, Card, EmptyState, SearchInput } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faCartShopping, faPlus, faXmark } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { ListPagination, MAX_TAKE, type PageSize } from '../../components/list-pagination';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  customerName,
  formatDate,
  formatMoney,
  paymentState,
  shippingState,
  useWholesaleOrders,
  type Order,
} from './orders-data';
import { RowOpenHint } from '../../components/row-open-hint';
// The SAME chips the shop's Orders list uses, from the one file that owns
// them. This list kept its own copy and had already lost "Canceled" from it.
import { FILTERS, emptyAdvice, targetFor, type FilterValue } from '../commerce/orders-list-filters';
import { orderBusiness, orderBuyer } from './wholesale-order-row';

export function WholesaleOrdersListSurface({ ctx }: { ctx: SurfaceContext }) {
  const accountId = typeof ctx.params.accountId === 'string' ? ctx.params.accountId : undefined;
  const accountName =
    typeof ctx.params.accountName === 'string' ? ctx.params.accountName : undefined;

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [take, setTake] = useState<number>(50);

  const active = FILTERS.find((entry) => entry.value === filter) ?? FILTERS[0];
  const skip = (page - 1) * pageSize;
  const narrowed = filter !== 'all' || search.trim() !== '';

  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useWholesaleOrders({
    q: search.trim(),
    status: active.status,
    owing: active.owing,
    accountId,
    sortBy: 'placedAt',
    order: 'desc',
    take,
    skip,
  });

  const rows = data?.items ?? [];
  const total = data?.total;

  const resetWindow = () => {
    setPage(1);
    setTake(pageSize);
  };

  const open = (order: Order, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('commerce.order.detail', { id: order.id }, { target: targetFor(event) });
  };

  // The same words as the `+` on this pane's nav row, which is the point: one
  // action should not have two names (issue 743).
  const enterAnOrder = () => {
    ctx.open('commerce.sale.new', { through: 'wholesale' }, { target: 'tab' });
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Wholesale orders controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search wholesale orders"
              placeholder="Order number or company…"
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
            key: 'state',
            value: filter,
            onValueChange: (next) => {
              setFilter((next as FilterValue | null) ?? 'all');
              resetWindow();
            },
            options: FILTERS,
          },
        ]}
        views={{
          target: '/b2b/orders',
          params: { q: search.trim() },
          onApply: (next) => {
            setSearch(next.q ?? '');
            resetWindow();
          },
        }}
        primary={
          <Button color="module" size="sm" className="shrink-0" onClick={enterAnOrder}>
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            Enter an order
          </Button>
        }
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

      {accountId && accountName ? (
        <div className="flex items-center gap-2">
          <Badge color="module" variant="soft">
            {accountName}
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            color="neutral"
            onClick={() => {
              ctx.open('b2b.orders.list', {}, { target: 'replace' });
            }}
          >
            <Icon glyph={faXmark} className="size-4" aria-hidden />
            Show all wholesale orders
          </Button>
        </div>
      ) : null}

      <Card className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <EmptyState
            icon={<Icon glyph={faCartShopping} className="size-6" aria-hidden />}
            title="Could not load your wholesale orders"
            description="This is a problem reaching the server. Your orders are unaffected. Nothing has been lost."
          />
        ) : isPending ? (
          <PaneWaiting label="Loading orders…" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Icon glyph={faCartShopping} className="size-6" aria-hidden />}
            title={narrowed ? 'No orders match that' : 'No wholesale orders yet'}
            description={
              narrowed
                ? // The shop's Orders list has used this helper since the chips
                  // were written; this copy of the screen kept a hand-typed
                  // sentence that named BOTH a search and a filter whichever one
                  // was on. Filtering by Canceled with an empty search box told
                  // her to "try a different word" she had never typed.
                  emptyAdvice(search.trim(), filter === 'all' ? null : active.label)
                : accountName
                  ? `Nothing from ${accountName} yet. Enter one here when they ring, or wait for them to order themselves.`
                  : 'Every order from a business you supply lands here, with what they bought and what they owe. Enter one yourself when a shop phones it through.'
            }
            actions={
              narrowed ? undefined : (
                <Button color="module" size="sm" onClick={enterAnOrder}>
                  <Icon glyph={faPlus} className="size-4" aria-hidden />
                  Enter an order
                </Button>
              )
            }
          />
        ) : (
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>Order</th>
                <th className="hidden @lg:table-cell">Business</th>
                <th className="hidden text-sm @2xl:table-cell">Placed</th>
                <th>Payment</th>
                <th className="hidden @xl:table-cell">Delivery</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => {
                const paid = paymentState(order);
                const shipped = shippingState(order);
                return (
                  <tr
                    key={order.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    role="button"
                    onClick={(event) => {
                      open(order, event);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      open(order, event);
                    }}
                  >
                    <td className="font-mono text-sm">{order.orderNumber}</td>
                    {/* The column is headed Business, so it says the business.
                        Who rang sits under it: a shop has several people who can
                        order and which one did is worth knowing. */}
                    <td className="hidden max-w-48 @lg:table-cell">
                      <span className="block truncate">
                        {orderBusiness(order) ?? customerName(order.customer)}
                      </span>
                      {orderBuyer(order) ? (
                        <span className="block truncate text-sm">{orderBuyer(order)}</span>
                      ) : null}
                    </td>
                    <td className="hidden text-sm @2xl:table-cell">{formatDate(order.placedAt)}</td>
                    <td>
                      <Badge color={paid.tone} variant="soft" size="sm">
                        {paid.label}
                      </Badge>
                    </td>
                    <td className="hidden @xl:table-cell">
                      <Badge color={shipped.tone} variant="soft" size="sm">
                        {shipped.label}
                      </Badge>
                    </td>
                    <td className="text-right font-medium tabular-nums">
                      {formatMoney(order.total, order.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

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
