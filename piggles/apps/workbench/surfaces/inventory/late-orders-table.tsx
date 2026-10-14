'use client';

// The table of overdue orders on What is overdue: sorted by money still to come,
// with how late each one is, counted in calendar days in the shop's own zone.

import { Badge } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { formatCents, plural } from './data';
import { formatDay, formatMoment } from './purchase-orders-data';
import { latenessTone, type LatePurchaseOrder } from './supplier-performance-data';
import { useBusinessZone } from '../../lib/business-timezone';
import { daysPastDue } from '../../lib/console/days';

type OpenOrder = (id: string, event: { shiftKey: boolean; altKey: boolean }) => void;

function LateOrderCell({ row }: { row: LatePurchaseOrder }) {
  return (
    <td className="w-full max-w-0 min-w-56">
      <span className="flex min-w-0 flex-col">
        <span className="truncate">
          <span className="font-mono">{row.number}</span>
          {' · '}
          {row.supplierName ?? 'Unnamed supplier'}
        </span>
        <span className="truncate text-sm">
          {/* Which date they are judged against: it changes what a buyer can say. */}
          {row.dueSource === 'expected_arrival'
            ? 'against the date on the order'
            : 'against their usual delivery time'}
          {/* The late-order event's only consumer is the webhooks under Tell other
              software; nobody is emailed, so say exactly that, both ways. */}
          {row.alertedAt === null
            ? ' · not passed to your other software yet'
            : ' · passed to your other software'}
        </span>
      </span>
    </td>
  );
}

function LateOrderRow({
  row,
  days,
  onOpen,
}: {
  row: LatePurchaseOrder;
  days: number;
  onOpen: OpenOrder;
}) {
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onOpen(row.purchaseOrderId, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(row.purchaseOrderId, event);
      }}
    >
      <LateOrderCell row={row} />
      <td className="whitespace-nowrap">
        <Badge color={latenessTone(days)} variant="soft" size="sm">
          {plural(days, 'day', 'days')}
        </Badge>
      </td>
      <td className="hidden whitespace-nowrap @lg:table-cell">
        {/* The date a buyer quotes down the phone. An order's date is a DAY; one
            worked out from a lead time is an instant; each gets its own formatter. */}
        {row.dueSource === 'expected_arrival' ? formatDay(row.dueAt) : formatMoment(row.dueAt)}
      </td>
      <td className="hidden text-right tabular-nums @xl:table-cell">{row.unitsOutstanding}</td>
      <td className="text-right tabular-nums">{formatCents(row.valueOutstandingCents)}</td>
    </tr>
  );
}

export function LateOrdersTable({
  rows,
  onOpen,
}: {
  rows: LatePurchaseOrder[];
  onOpen: OpenOrder;
}) {
  // Calendar days in the SHOP's zone (`lib/console/days.ts`), not the server's UTC
  // seconds; the server's figure is the fallback when there is no date to count from.
  const zone = useBusinessZone();
  const now = new Date();
  const lateDays = (row: LatePurchaseOrder): number =>
    daysPastDue(row.dueAt, now, zone) ?? row.daysLate;

  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Order</th>
          <th className="whitespace-nowrap">Overdue by</th>
          <th className="hidden whitespace-nowrap @lg:table-cell">Was due</th>
          <th className="hidden text-right whitespace-nowrap @xl:table-cell">Still to come</th>
          <th className="text-right whitespace-nowrap">Value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <LateOrderRow key={row.purchaseOrderId} row={row} days={lateDays(row)} onOpen={onOpen} />
        ))}
      </tbody>
    </Table>
  );
}
