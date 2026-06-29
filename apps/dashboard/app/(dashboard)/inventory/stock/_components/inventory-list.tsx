'use client';

import Link from 'next/link';
import {
  Badge,
  type SelectionCard,
  type SelectionColumn,
  SelectionList,
  Stack,
  Text,
} from '@sparx/ui';

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
    <Stack gap={0}>
      <Link
        href={`/commerce/products/${r.productId}`}
        className="text-sm hover:text-[var(--module-active)]"
      >
        {r.productTitle}
      </Link>
      {r.variantTitle && (
        <Text size="xs" variant="muted">
          {r.variantTitle}
        </Text>
      )}
    </Stack>
  );
}

function reorderBadge(r: InventoryRow) {
  return r.reorderPoint !== null ? (
    <Badge color={isBelowReorder(r) ? 'warning' : 'neutral'} variant="soft" size="sm">
      ≤ {r.reorderPoint}
    </Badge>
  ) : (
    <Text size="xs" variant="muted">
      none
    </Text>
  );
}

function availableCell(r: InventoryRow) {
  return (
    <Text className={isBelowReorder(r) ? 'text-[var(--color-warning)]' : undefined}>
      {r.available}
    </Text>
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
      <Stack gap={2}>
        <Stack direction="row" gap={4}>
          <Stack gap={0}>
            <Text size="xs" variant="muted">
              On hand
            </Text>
            <Text className="tabular-nums">{r.onHand}</Text>
          </Stack>
          <Stack gap={0}>
            <Text size="xs" variant="muted">
              Allocated
            </Text>
            <Text className="tabular-nums">{r.allocated}</Text>
          </Stack>
          <Stack gap={0}>
            <Text size="xs" variant="muted">
              Available
            </Text>
            {availableCell(r)}
          </Stack>
        </Stack>
        <InventoryRowControls row={r} warehouseId={warehouseId} />
      </Stack>
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
