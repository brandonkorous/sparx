'use client';

import Link from 'next/link';
import { Badge } from '@wizeworks/silicaui-react';
import { type SelectionCard, type SelectionColumn, SelectionList } from '@sparx/ui';

import { InventoryRowControls, type InventoryRow } from './inventory-row-editor';

// Client wrapper for the per-warehouse stock list. SelectionList takes render
// functions (columns/card), which can't cross the server→client boundary, so
// the server page hands rows + view + warehouseId here and this builds both
// views. Read-only selection (`selectable={false}`); each row keeps the
// InventoryRowControls island (inline Adjust / Reorder editor) unchanged — in
// the table its own "Actions" column, in cards the body.

interface InventoryListProps {
  rows: InventoryRow[];
  warehouseId: string;
  view: 'table' | 'card';
}

function isBelowReorder(r: InventoryRow): boolean {
  return r.reorderPoint !== null && r.available <= r.reorderPoint;
}

function productCell(r: InventoryRow) {
  return (
    <div className="flex flex-col gap-0">
      <Link href={`/commerce/products/${r.productId}`} className="hover:text-module text-sm">
        {r.productTitle}
      </Link>
      {r.variantTitle && <p className="text-base-content text-xs">{r.variantTitle}</p>}
    </div>
  );
}

function reorderBadge(r: InventoryRow) {
  return r.reorderPoint !== null ? (
    <Badge color={isBelowReorder(r) ? 'warning' : 'neutral'} variant="soft" size="sm">
      ≤ {r.reorderPoint}
    </Badge>
  ) : (
    <p className="text-base-content text-xs">none</p>
  );
}

function availableCell(r: InventoryRow) {
  return (
    <p className={isBelowReorder(r) ? 'text-warning text-base' : 'text-base'}>{r.available}</p>
  );
}

export function InventoryList({ rows, warehouseId, view }: InventoryListProps) {
  const columns: SelectionColumn<InventoryRow>[] = [
    { header: 'SKU', cell: (r) => <span className="font-mono text-xs">{r.sku}</span> },
    { header: 'Product', cell: productCell },
    { header: 'On hand', align: 'right', cell: (r) => r.onHand },
    { header: 'Allocated', align: 'right', cell: (r) => r.allocated },
    { header: 'Available', align: 'right', cell: availableCell },
    { header: 'Reorder', cell: reorderBadge },
    {
      header: 'Actions',
      id: 'actions',
      cell: (r) => <InventoryRowControls row={r} warehouseId={warehouseId} />,
    },
  ];

  const card: SelectionCard<InventoryRow> = {
    title: (r) => <span className="truncate font-mono text-sm">{r.sku}</span>,
    subtitle: productCell,
    badge: reorderBadge,
    body: (r) => (
      <div className="flex flex-col gap-2">
        <div className="flex flex-row gap-4">
          <div className="flex flex-col gap-0">
            <p className="text-base-content text-xs">On hand</p>
            <p className="text-base tabular-nums">{r.onHand}</p>
          </div>
          <div className="flex flex-col gap-0">
            <p className="text-base-content text-xs">Allocated</p>
            <p className="text-base tabular-nums">{r.allocated}</p>
          </div>
          <div className="flex flex-col gap-0">
            <p className="text-base-content text-xs">Available</p>
            {availableCell(r)}
          </div>
        </div>
        <InventoryRowControls row={r} warehouseId={warehouseId} />
      </div>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(r) => `${r.variantId}:${r.warehouseId}`}
      selectable={false}
      getRowLabel={(r) => r.sku}
      entityLabelPlural="variants"
      columns={columns}
      card={card}
    />
  );
}
