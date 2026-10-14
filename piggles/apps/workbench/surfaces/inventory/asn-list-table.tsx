'use client';

// The table of shipment notices on the On the way list: one row per notice, its
// state as a badge, and the columns that disclose with @container.

import { Badge, Text } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { dayCountLabel } from './purchase-orders-data';
import { daysUntilDue } from '../../lib/console/days';
import {
  asnSourceLabel,
  asnStatusLabel,
  asnStatusTone,
  type AdvanceShipNotice,
} from './advance-ship-notices-data';

type OpenNotice = (id: string, event: { shiftKey: boolean; altKey: boolean }) => void;

interface RowProps {
  row: AdvanceShipNotice;
  now: Date;
  zone: string | null | undefined;
  onOpen: OpenNotice;
}

function AsnShipmentCell({ row }: { row: AdvanceShipNotice }) {
  return (
    <td className="w-full max-w-0 min-w-56">
      <span className="flex min-w-0 flex-col">
        <span className="truncate">
          <span className="font-mono">{row.number}</span>
          {' · '}
          {row.supplierName ?? 'Unnamed supplier'}
        </span>
        <span className="truncate text-sm">
          against <span className="font-mono">{row.purchaseOrderNumber ?? '—'}</span>
          {row.reference ? ` · their ref ${row.reference}` : ''}
          {' · '}
          {asnSourceLabel(row.source)}
        </span>
      </span>
    </td>
  );
}

function AsnRow({ row, now, zone, onOpen }: RowProps) {
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onOpen(row.id, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(row.id, event);
      }}
    >
      <AsnShipmentCell row={row} />
      <td className="whitespace-nowrap">
        <Badge color={asnStatusTone(row)} variant="soft" size="sm">
          {asnStatusLabel(row)}
        </Badge>
      </td>
      <td className="hidden whitespace-nowrap @lg:table-cell">
        {row.expectedArrivalAt ? (
          dayCountLabel(daysUntilDue(row.expectedArrivalAt, now, zone))
        ) : (
          <Text className="text-sm">No date given</Text>
        )}
      </td>
      <td className="hidden text-right tabular-nums @xl:table-cell">{row.unitsShipped}</td>
      <td className="hidden whitespace-nowrap @2xl:table-cell">
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{row.carrier ?? '—'}</span>
          {row.trackingNumber ? (
            <span className="truncate font-mono text-sm">{row.trackingNumber}</span>
          ) : null}
        </span>
      </td>
    </tr>
  );
}

export function AsnListTable({
  rows,
  now,
  zone,
  onOpen,
}: {
  rows: AdvanceShipNotice[];
  now: Date;
  zone: string | null | undefined;
  onOpen: OpenNotice;
}) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Shipment</th>
          <th className="whitespace-nowrap">State</th>
          <th className="hidden whitespace-nowrap @lg:table-cell">Expected</th>
          <th className="hidden text-right whitespace-nowrap @xl:table-cell">Units</th>
          <th className="hidden whitespace-nowrap @2xl:table-cell">Carrier</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <AsnRow key={row.id} row={row} now={now} zone={zone} onOpen={onOpen} />
        ))}
      </tbody>
    </Table>
  );
}
