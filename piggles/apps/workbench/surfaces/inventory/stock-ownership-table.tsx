'use client';

// The table on Whose stock: one row per item and location that is not yours,
// whose it is, who owns it, how many are on hand, and what they are worth.

import { Badge, Text } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { ItemName } from './item-name';
import { formatCents } from './data';
import { ownershipLabel, ownershipTone, type OwnedStock } from './demand-data';

type OpenItem = (variantId: string, event: { shiftKey: boolean; altKey: boolean }) => void;

function OwnedStockRow({ row, onOpen }: { row: OwnedStock; onOpen: OpenItem }) {
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onOpen(row.variantId, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(row.variantId, event);
      }}
    >
      <td className="w-full max-w-0 min-w-56">
        <span className="flex min-w-0 flex-col">
          <ItemName
            productTitle={row.productTitle}
            variantName={row.variantName}
            code={row.variantSku}
          />
          <span className="truncate text-sm">{row.warehouseName ?? 'Unknown location'}</span>
        </span>
      </td>
      <td className="whitespace-nowrap">
        <Badge color={ownershipTone(row.ownership)} variant="soft" size="sm">
          {ownershipLabel(row.ownership)}
        </Badge>
      </td>
      <td className="hidden max-w-[14rem] truncate @lg:table-cell" data-label="Owner">
        {/* Named, or conspicuously not: consigned stock with no owner is a debt to
            nobody, and settlement will refuse it later. */}
        {row.ownerSupplierName ?? row.ownerCustomerName ?? (
          <Text className="text-sm">nobody named</Text>
        )}
      </td>
      <td className="text-right tabular-nums" data-label="On hand">
        {row.onHand}
      </td>
      <td className="text-right tabular-nums" data-label="Value">
        {row.valueCents === null ? (
          <Text className="text-sm">not costed</Text>
        ) : (
          formatCents(row.valueCents)
        )}
      </td>
    </tr>
  );
}

export function StockOwnershipTable({ rows, onOpen }: { rows: OwnedStock[]; onOpen: OpenItem }) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Item</th>
          <th>Whose</th>
          <th className="hidden @lg:table-cell">Owner</th>
          <th className="text-right whitespace-nowrap">On hand</th>
          <th className="text-right whitespace-nowrap">Value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <OwnedStockRow key={`${row.variantId}:${row.warehouseId}`} row={row} onOpen={onOpen} />
        ))}
      </tbody>
    </Table>
  );
}
