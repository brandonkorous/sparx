'use client';

// The returns table: one row per return, opened with the same click and keyboard
// contract as every other list in the console.

import { Badge } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { formatDate } from './data';
import { outcomeLabel, returnState, type ReturnSummary } from './returns-data';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

function ReturnRow({
  row,
  onOpen,
}: {
  row: ReturnSummary;
  onOpen: (row: ReturnSummary, event: OpenEvent) => void;
}) {
  const state = returnState(row.status, row.preferredOutcome);
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onOpen(row, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(row, event);
      }}
    >
      <td className="font-mono text-sm">{row.orderNumber ?? '—'}</td>
      <td data-label="Customer" className="hidden max-w-48 truncate @lg:table-cell">
        {/* A null order number means the SALE is gone, and then "Unknown customer"
            is a guess dressed as a fact: there is nobody to know (issue 225). */}
        {row.orderNumber === null ? 'The sale is gone' : (row.customerName ?? 'Unknown customer')}
      </td>
      <td data-label="Asked" className="hidden text-sm @2xl:table-cell">
        {formatDate(row.requestedAt)}
      </td>
      <td data-label="Wants" className="hidden @xl:table-cell">
        {outcomeLabel(row.preferredOutcome)}
      </td>
      <td data-label="Items" className="text-right tabular-nums @lg:text-left">
        {row.itemCount}
      </td>
      <td>
        {row.orderNumber === null ? (
          <Badge color="warning" variant="soft" size="sm">
            Nothing to do
          </Badge>
        ) : (
          <Badge color={state.tone} variant="soft" size="sm">
            {state.label}
          </Badge>
        )}
      </td>
    </tr>
  );
}

export function ReturnsTable({
  rows,
  onOpen,
}: {
  rows: ReturnSummary[];
  onOpen: (row: ReturnSummary, event: OpenEvent) => void;
}) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Order</th>
          <th className="hidden @lg:table-cell">Customer</th>
          <th className="hidden @2xl:table-cell">Asked</th>
          <th className="hidden @xl:table-cell">Wants</th>
          <th className="text-right @lg:text-left">Items</th>
          <th>Stage</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <ReturnRow key={row.id} row={row} onOpen={onOpen} />
        ))}
      </tbody>
    </Table>
  );
}
