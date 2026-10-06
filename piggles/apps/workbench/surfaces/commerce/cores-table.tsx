'use client';

// The rows of the cores owed list: one per order line with old parts still out.
// A send-first line holds no deposit, so it says so instead of printing $0.00.

import { Badge } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { formatDate } from './data';
import { coreLineOfOwed, plural, type CoreOwed } from './cores-data';
import { depositBackText, type CoreMove } from './core-line-words';
import { CoreBadges, CoreMoveButtons } from './order-cores';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

/** Older is louder: a month out is worth a call, two months is a problem. */
function ageTone(daysOut: number): 'error' | 'warning' | 'info' {
  if (daysOut > 60) return 'error';
  if (daysOut > 30) return 'warning';
  return 'info';
}

function PartCell({ row }: { row: CoreOwed }) {
  return (
    <td className="max-w-64">
      <span className="block truncate">{row.name}</span>
      <span className="block font-mono text-sm">{row.sku}</span>
      {row.coreFirst ? (
        <span className="mt-1 flex flex-wrap gap-1">
          <CoreBadges line={coreLineOfOwed(row)} />
        </span>
      ) : null}
    </td>
  );
}

function AgeCell({ row }: { row: CoreOwed }) {
  return (
    <td>
      <Badge
        color={ageTone(row.daysOut)}
        variant="soft"
        size="sm"
        title={`Ordered ${formatDate(row.placedAt)}`}
      >
        {plural(row.daysOut, 'day', 'days')}
      </Badge>
    </td>
  );
}

function CoreRow({
  row,
  onOpen,
  onMove,
}: {
  row: CoreOwed;
  onOpen: (event: OpenEvent) => void;
  onMove: (move: CoreMove) => void;
}) {
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(event);
      }}
    >
      <td className="font-mono text-sm">
        {row.orderNumber}
        <span className="block font-sans text-sm @lg:hidden">{row.customerName}</span>
      </td>
      <td className="hidden max-w-48 truncate @lg:table-cell">
        {row.customerName}
        {row.companyName ? <span className="block text-sm">{row.companyName}</span> : null}
      </td>
      <PartCell row={row} />
      <td className="text-right tabular-nums">
        {row.coresOwed} of {row.quantity}
      </td>
      <td className="hidden text-right tabular-nums @xl:table-cell">{depositBackText(row)}</td>
      <AgeCell row={row} />
      <td className="hidden @3xl:table-cell">
        <span className="flex flex-wrap justify-end gap-1">
          <CoreMoveButtons line={coreLineOfOwed(row)} onMove={onMove} stopPropagation />
        </span>
      </td>
    </tr>
  );
}

export function CoresTable({
  rows,
  onOpen,
  onMove,
}: {
  rows: CoreOwed[];
  onOpen: (row: CoreOwed, event: OpenEvent) => void;
  onMove: (row: CoreOwed, move: CoreMove) => void;
}) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Order</th>
          <th className="hidden @lg:table-cell">Customer</th>
          <th>Part</th>
          <th className="text-right">Owed</th>
          <th className="hidden text-right @xl:table-cell">Deposit back</th>
          <th>Out for</th>
          <th className="hidden @3xl:table-cell">
            <span className="sr-only">What to do</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <CoreRow
            key={row.orderItemId}
            row={row}
            onOpen={(event) => {
              onOpen(row, event);
            }}
            onMove={(move) => {
              onMove(row, move);
            }}
          />
        ))}
      </tbody>
    </Table>
  );
}
