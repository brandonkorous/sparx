'use client';

// The orders table — the rows and the sortable headings.
//
// Columns disclose with @container, never a viewport query: pane width and
// screen width are unrelated here, and a viewport breakpoint leaves a narrow
// pane on a wide monitor rendering six columns into 300px.

import { Badge } from '@wizeworks/silicaui-react';
import { faArrowDown, faArrowUp } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Table } from '../../components/table';
import {
  customerName,
  formatDate,
  formatMoney,
  paymentState,
  shippingState,
  type Order,
  type OrderSortKey,
  type SortDirection,
} from './data';

export interface OrdersSort {
  key: OrderSortKey;
  dir: SortDirection;
}

function SortHeader({
  sortKey,
  label,
  className,
  sort,
  onSort,
}: {
  sortKey: OrderSortKey;
  label: string;
  className?: string;
  sort: OrdersSort;
  onSort: (key: OrderSortKey) => void;
}) {
  const on = sort.key === sortKey;
  return (
    <th
      className={className}
      aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className="link link-hover inline-flex items-center gap-1"
        onClick={() => {
          onSort(sortKey);
        }}
      >
        {label}
        {on ? (
          <Icon
            glyph={sort.dir === 'asc' ? faArrowUp : faArrowDown}
            className="size-3"
            aria-hidden
          />
        ) : null}
      </button>
    </th>
  );
}

function OrderRow({
  order,
  onOpen,
}: {
  order: Order;
  onOpen: (order: Order, event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  const paid = paymentState(order);
  const shipped = shippingState(order);
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onOpen(order, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(order, event);
      }}
    >
      <td className="font-mono text-sm">{order.orderNumber}</td>
      <td className="hidden max-w-48 truncate @lg:table-cell">{customerName(order.customer)}</td>
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
}

export function OrdersTable({
  rows,
  sort,
  onSort,
  onOpen,
}: {
  rows: Order[];
  sort: OrdersSort;
  onSort: (key: OrderSortKey) => void;
  onOpen: (order: Order, event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Order</th>
          <th className="hidden @lg:table-cell">Customer</th>
          <SortHeader
            sortKey="placedAt"
            label="Placed"
            className="hidden @2xl:table-cell"
            sort={sort}
            onSort={onSort}
          />
          <th>Payment</th>
          <th className="hidden @xl:table-cell">Delivery</th>
          <SortHeader
            sortKey="total"
            label="Total"
            className="text-right"
            sort={sort}
            onSort={onSort}
          />
        </tr>
      </thead>
      <tbody>
        {rows.map((order) => (
          <OrderRow key={order.id} order={order} onOpen={onOpen} />
        ))}
      </tbody>
    </Table>
  );
}
