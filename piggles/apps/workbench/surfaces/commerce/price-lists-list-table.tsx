'use client';

// The special-prices table: who each list is for, its currency, how many prices it
// holds and whether it is live, with columns disclosing as the pane widens.

import { Badge, Text } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { audienceSummary, priceListState, type PriceListRow } from './price-lists-data';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

function PriceListRowView({
  row,
  onOpen,
}: {
  row: PriceListRow;
  onOpen: (event: OpenEvent) => void;
}) {
  const state = priceListState(row);
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
      <td className="font-medium">
        <span className="block">{row.name}</span>
        <Text as="span" className="text-sm @lg:hidden">
          {audienceSummary(row)}
        </Text>
      </td>
      <td className="hidden @lg:table-cell">{audienceSummary(row)}</td>
      <td className="hidden font-mono text-sm @xl:table-cell">{row.currency}</td>
      <td className="hidden text-right tabular-nums @md:table-cell">
        {row.entryCount === 1 ? '1 price' : `${String(row.entryCount)} prices`}
      </td>
      <td className="text-right">
        <Badge color={state.tone} variant="soft" size="sm">
          {state.label}
        </Badge>
      </td>
    </tr>
  );
}

export function PriceListsTable({
  rows,
  onOpen,
}: {
  rows: PriceListRow[];
  onOpen: (id: string, event: OpenEvent) => void;
}) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Name</th>
          <th className="hidden @lg:table-cell">Who it&apos;s for</th>
          <th className="hidden @xl:table-cell">Currency</th>
          <th className="hidden text-right @md:table-cell">Prices</th>
          <th className="text-right">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <PriceListRowView
            key={row.id}
            row={row}
            onOpen={(event) => {
              onOpen(row.id, event);
            }}
          />
        ))}
      </tbody>
    </Table>
  );
}
