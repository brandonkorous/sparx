'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Badge } from '@wizeworks/silicaui-react';
import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';

import { formatDate, transferStatus, warehouseLabel, type InventoryTransferRow } from './types';

// Client wrapper for the transfer list. SelectionList takes render functions
// (columns/card) that can't cross the server→client boundary, so the server page
// hands rows + view here. Read-only; the number links to the transfer detail.

interface TransfersListProps {
  rows: InventoryTransferRow[];
  view: 'table' | 'card';
}

export function TransfersList({ rows, view }: TransfersListProps) {
  const numberLink = (t: InventoryTransferRow) => (
    <Link href={`/inventory/transfers/${t.id}`} className="hover:text-module font-mono text-xs">
      {t.number}
    </Link>
  );

  const statusBadge = (t: InventoryTransferRow) => {
    const s = transferStatus(t.status);
    return <Badge color={s.color}>{s.label}</Badge>;
  };

  const route = (t: InventoryTransferRow) => (
    <div className="flex min-w-0 flex-row items-center gap-1">
      <p className="truncate text-sm">{warehouseLabel(t.fromWarehouseName, t.fromWarehouseCode)}</p>
      <ArrowRight className="text-base-content h-3.5 w-3.5 shrink-0" />
      <p className="truncate text-sm">{warehouseLabel(t.toWarehouseName, t.toWarehouseCode)}</p>
    </div>
  );

  const units = (t: InventoryTransferRow) => (
    <p className="text-sm">
      {t.totalQuantity} unit{t.totalQuantity === 1 ? '' : 's'} · {t.lineCount} line
      {t.lineCount === 1 ? '' : 's'}
    </p>
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
      <div className="flex flex-col gap-2">
        {units(t)}
        <p className="text-base-content text-xs">created {formatDate(t.createdAt)}</p>
      </div>
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
