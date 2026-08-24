'use client';

// The worklist table. Each row carries several numbers a buyer compares down a
// column, which is exactly the case the house rule keeps tables for.

import { Checkbox } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { velocityLabel, type ReorderRow } from './reorder-data';
import { ChooseCell, ItemCell, NumberCells, SupplierCell } from './reorder-list-cells';
import { rowKey } from './reorder-shared';
import type { ListSelection } from '../../lib/workbench/selection';

interface Modifiers {
  shiftKey: boolean;
  altKey: boolean;
}

function HeaderRow({
  allPageSelected,
  someSelected,
  selectable,
  onToggleAll,
}: {
  allPageSelected: boolean;
  someSelected: boolean;
  selectable: boolean;
  onToggleAll: () => void;
}) {
  return (
    <tr>
      <th className="w-0">
        <Checkbox
          color="module"
          aria-label="Choose every line here that can be ordered"
          checked={allPageSelected}
          disabled={!selectable}
          ref={(el) => {
            if (el) el.indeterminate = !allPageSelected && someSelected;
          }}
          onChange={onToggleAll}
        />
      </th>
      <th>Item</th>
      <th className="hidden @2xl:table-cell">Supplier</th>
      <th className="hidden text-right whitespace-nowrap @lg:table-cell">Available</th>
      <th className="hidden whitespace-nowrap @3xl:table-cell">Takes</th>
      <th className="hidden text-right whitespace-nowrap @xl:table-cell">Sells</th>
      <th className="text-right whitespace-nowrap">To order</th>
      <th className="hidden text-right whitespace-nowrap @3xl:table-cell">On the way</th>
      <th className="whitespace-nowrap">Runs out</th>
      <th className="text-right whitespace-nowrap">At risk</th>
    </tr>
  );
}

function Row({
  row,
  checked,
  onToggle,
  onOpen,
}: {
  row: ReorderRow;
  checked: boolean;
  onToggle: (row: ReorderRow, on: boolean, modifiers: { shiftKey: boolean }) => void;
  onOpen: (row: ReorderRow, event: Modifiers) => void;
}) {
  const sells = velocityLabel(row);

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
      <ChooseCell row={row} checked={checked} onToggle={onToggle} />
      <ItemCell row={row} sells={sells} />
      <SupplierCell row={row} />
      <NumberCells row={row} sells={sells} />
    </tr>
  );
}

export function ReorderListTable({
  rows,
  selection,
  onOpen,
}: {
  rows: ReorderRow[];
  selection: ListSelection<ReorderRow>;
  onOpen: (row: ReorderRow, event: Modifiers) => void;
}) {
  return (
    <Table size="sm" hover>
      <thead>
        <HeaderRow
          allPageSelected={selection.allOnPageChosen}
          someSelected={selection.someOnPageChosen}
          selectable={selection.selectable.length > 0}
          onToggleAll={selection.toggleAllOnPage}
        />
      </thead>
      <tbody>
        {rows.map((row) => (
          <Row
            key={rowKey(row)}
            row={row}
            checked={selection.has(rowKey(row))}
            onToggle={selection.toggle}
            onOpen={onOpen}
          />
        ))}
      </tbody>
    </Table>
  );
}
