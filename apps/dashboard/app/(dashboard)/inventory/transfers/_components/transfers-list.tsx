'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import {
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Badge,
  Stack,
  Text,
} from '@sparx/ui';

import {
  formatDate,
  transferStatus,
  warehouseLabel,
  type InventoryTransferRow,
} from './types';

// Client wrapper for the transfer list. SelectionList takes render functions
// (columns/card) that can't cross the server→client boundary, so the server page
// hands rows + view here. Read-only; the number links to the transfer detail.

interface TransfersListProps {
  rows: InventoryTransferRow[];
  view: 'table' | 'card';
}

export function TransfersList({ rows, view }: TransfersListProps) {
  const numberLink = (t: InventoryTransferRow) => (
    <Link
      href={`/inventory/transfers/${t.id}`}
      className="font-mono text-xs hover:text-[var(--module-active)]"
    >
      {t.number}
    </Link>
  );

  const statusBadge = (t: InventoryTransferRow) => {
    const s = transferStatus(t.status);
    return <Badge color={s.color}>{s.label}</Badge>;
  };

  const route = (t: InventoryTransferRow) => (
    <Stack direction="row" align="center" gap={1} className="min-w-0">
      <Text size="sm" className="truncate">
        {warehouseLabel(t.fromWarehouseName, t.fromWarehouseCode)}
      </Text>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
      <Text size="sm" className="truncate">
        {warehouseLabel(t.toWarehouseName, t.toWarehouseCode)}
      </Text>
    </Stack>
  );

  const units = (t: InventoryTransferRow) => (
    <Text size="sm">
      {t.totalQuantity} unit{t.totalQuantity === 1 ? '' : 's'} · {t.lineCount} line
      {t.lineCount === 1 ? '' : 's'}
    </Text>
  );

  const columns: SelectionColumn<InventoryTransferRow>[] = [
    { header: 'Number', cell: numberLink },
    { header: 'Route', cell: route },
    { header: 'Status', cell: statusBadge },
    { header: 'Units', cell: units },
    { header: 'Created', cell: (t) => formatDate(t.createdAt) },
  ];

  const card: SelectionCard<InventoryTransferRow> = {
    title: route,
    subtitle: numberLink,
    badge: statusBadge,
    body: (t) => (
      <Stack gap={2}>
        {units(t)}
        <Text size="xs" variant="muted">
          created {formatDate(t.createdAt)}
        </Text>
      </Stack>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(t) => t.id}
      selectable={false}
      entityLabelPlural="transfers"
      getRowLabel={(t) => t.number}
      columns={columns}
      card={card}
    />
  );
}
