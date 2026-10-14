'use client';

// The rows of the Carts list. Each row opens the cart; shift opens it beside,
// alt in a new window.

import { Badge } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import type { OpenTarget } from '../../lib/surfaces/registry';
import { formatMoney, formatDateTime } from './data';
import { cartShopperName, cartStateFrom, type CartRow } from './carts-data';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

export function cartOpenTarget(event: OpenEvent): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function CartRowView({ row, onOpen }: { row: CartRow; onOpen: (event: OpenEvent) => void }) {
  const state = cartStateFrom(row);
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onOpen(event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(event);
      }}
    >
      <td className="max-w-48 truncate">{cartShopperName(row.customer, row.contact)}</td>
      <td className="text-right tabular-nums @lg:text-left">{row.itemCount}</td>
      <td className="hidden text-sm @2xl:table-cell">{formatDateTime(row.updatedAt)}</td>
      <td className="hidden @xl:table-cell">
        <Badge color={state.tone} variant="soft" size="sm">
          {state.label}
        </Badge>
      </td>
      <td className="text-right font-medium tabular-nums">
        {formatMoney(row.totalCents / 100, row.currency)}
      </td>
    </tr>
  );
}

export function CartsTable({
  rows,
  onOpen,
}: {
  rows: CartRow[];
  onOpen: (row: CartRow, event: OpenEvent) => void;
}) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Shopper</th>
          <th className="text-right @lg:text-left">Items</th>
          <th className="hidden @2xl:table-cell">Last active</th>
          <th className="hidden @xl:table-cell">State</th>
          <th className="text-right">Value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <CartRowView
            key={row.id}
            row={row}
            onOpen={(event) => {
              onOpen(row, event);
            }}
          />
        ))}
      </tbody>
    </Table>
  );
}
