'use client';

// Customer orders — the same orders as Selling, seen from the customer's side.
//
// This is Commerce data inside the CRM module, so it does two things carefully:
// it does NOT re-model an order (it reuses the commerce order data layer whole,
// and opens the real order detail on click), and it wears the COMMERCE hue via a
// nested ModuleScope so the rows read as Selling even though the CRM chrome
// stays. There is no "new order" here — orders are placed at checkout, never
// typed up in the CRM.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Badge, Button, Card, EmptyState, SearchInput, Select } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faReceipt } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { ModuleScope } from '../../components/module-scope';
import {
  customerName,
  formatDate,
  formatMoney,
  shippingState,
  useOrders,
  type Order,
} from '../commerce/data';
import { FILTERS } from '../commerce/orders-list-filters';
import { RowOpenHint } from '../../components/row-open-hint';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

// A THIRD COPY OF THE ORDERS FILTER LIVED HERE, AND IT HAD DRIFTED FURTHEST.
//
// `orders-list-filters.ts` exists because the shop's Orders and Wholesale
// orders kept two hand-copied lists that disagreed. This pane kept a third,
// built straight out of the stored values, and it disagreed with the BADGES on
// its own rows: the filter said Placed / Fulfilled / Delivered while the table
// beside it said To send / On the way / Collected. Six rows apart, two
// vocabularies for one fact.
//
// "Fulfilled" is the exact word `shippingState` was written to keep off the
// screen — its own header says it "reads as finished to everyone who has not
// worked in commerce, when it means the opposite". It was the only rendered
// "Fulfilled" left in this console.
//
// The shared list also refuses to name a delivery method, because one stored
// status covers both sending and collecting, and it leaves "Refunded" out for
// a stated reason. This copy did neither.
const STATUS_ITEMS: Record<string, string> = {
  all: 'All orders',
  ...Object.fromEntries(
    FILTERS.filter((f) => f.status).map((f): [string, string] => [f.status ?? '', f.label]),
  ),
};

export function CustomerOrdersSurface({ ctx }: { ctx: SurfaceContext }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useOrders({
    ...(search.trim() ? { q: search.trim() } : {}),
    ...(status === 'all' ? {} : { status }),
    sortBy: 'placedAt',
    order: 'desc',
    take: 100,
    skip: 0,
  });

  const rows = data?.items ?? [];
  const total = data?.total;
  const filtered = search.trim() !== '' || status !== 'all';

  const open = (order: Order, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('commerce.order.detail', { id: order.id }, { target: targetFor(event) });
  };

  return (
    // The whole surface wears the Commerce hue: this is Selling's data, and the
    // one signal that says so is the module color on its controls.
    <ModuleScope module="commerce" className="h-full">
      <div className={PANE_SHELL}>
        <PaneToolbar
          label="Customer orders controls"
          search={
            <div className="max-w-xs min-w-0 flex-1">
              <SearchInput
                color="module"
                size="sm"
                aria-label="Search orders"
                placeholder="Search by order number…"
                value={search}
                onValueChange={setSearch}
              />
            </div>
          }
          controls={
            <div className="hidden w-40 shrink-0 @lg:block">
              <Select
                color="module"
                size="sm"
                aria-label="Which orders to show"
                value={status}
                items={STATUS_ITEMS}
                onValueChange={(next) => {
                  setStatus(next as string);
                }}
              />
            </div>
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

        <Card className="min-h-0 flex-1 overflow-y-auto">
          {isError ? (
            <EmptyState
              icon={<Icon glyph={faReceipt} className="size-6" aria-hidden />}
              title="Could not load orders"
              description="Something went wrong reaching the server. It may be a temporary problem. Try again in a moment."
              actions={
                <Button
                  size="sm"
                  color="module"
                  onClick={() => {
                    void refetch();
                  }}
                >
                  Try again
                </Button>
              }
            />
          ) : isPending ? (
            <PaneWaiting />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Icon glyph={faReceipt} className="size-6" aria-hidden />}
              title={filtered ? 'No orders match those filters' : 'No orders yet'}
              description={
                filtered
                  ? 'Try a different order number, or clear the filters to see them all.'
                  : 'Orders your customers place appear here. They are the same orders as in Selling, seen from the customer’s side.'
              }
            />
          ) : (
            <Table size="sm" hover>
              <thead>
                <tr>
                  <th>Order</th>
                  <th className="hidden @md:table-cell">Customer</th>
                  <th className="hidden @lg:table-cell">Placed</th>
                  <th>Status</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const state = shippingState(row);
                  return (
                    <tr
                      key={row.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      role="button"
                      onClick={(event) => {
                        open(row, event);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        open(row, event);
                      }}
                    >
                      <td className="font-mono text-sm">{row.orderNumber}</td>
                      <td className="hidden @md:table-cell">{customerName(row.customer)}</td>
                      <td className="hidden text-sm @lg:table-cell">{formatDate(row.placedAt)}</td>
                      <td>
                        <Badge color={state.tone} variant="soft" size="sm">
                          {state.label}
                        </Badge>
                      </td>
                      <td className="text-right font-mono text-sm tabular-nums">
                        {formatMoney(row.total, row.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="flex shrink-0 items-center justify-between px-1">
          {rows.length > 0 ? <RowOpenHint /> : null}
          {typeof total === 'number' && !isPending ? (
            <p className="text-xs">
              {filtered
                ? `${rows.length.toLocaleString()} shown`
                : `${total.toLocaleString()} in total`}
            </p>
          ) : null}
        </div>
      </div>
    </ModuleScope>
  );
}
