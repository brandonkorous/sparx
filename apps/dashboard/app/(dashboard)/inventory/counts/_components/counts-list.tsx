'use client';

import Link from 'next/link';

import { Badge } from '@wizeworks/silicaui-react';
import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';

import {
  countStatus,
  countTypeLabel,
  formatDate,
  formatMoney,
  type InventoryCountRow,
} from './types';

// Client wrapper for the count list. SelectionList takes render functions
// (columns/card) that can't cross the server→client boundary, so the server page
// hands rows + view here. Read-only; the number links to the count detail.

interface CountsListProps {
  rows: InventoryCountRow[];
  view: 'table' | 'card';
}

export function CountsList({ rows, view }: CountsListProps) {
  const numberLink = (c: InventoryCountRow) => (
    <Link href={`/inventory/counts/${c.id}`} className="hover:text-module font-mono text-xs">
      {c.number}
    </Link>
  );

  const statusBadge = (c: InventoryCountRow) => {
    const s = countStatus(c.status);
    return (
      <div className="flex flex-row flex-wrap items-center gap-1">
        <Badge color={s.color}>{s.label}</Badge>
        {c.requiresApproval && c.status !== 'posted' && c.status !== 'cancelled' ? (
          <Badge color="warning" variant="soft">
            needs approval
          </Badge>
        ) : null}
      </div>
    );
  };

  const progress = (c: InventoryCountRow) => (
    <p className="text-base-content text-xs">
      {c.countedLineCount}/{c.lineCount} counted
    </p>
  );

  const variance = (c: InventoryCountRow) =>
    c.status === 'counting' ? '—' : formatMoney(c.varianceValueCents);

  const columns: SelectionColumn<InventoryCountRow>[] = [
    { header: 'Number', cell: numberLink },
    { header: 'Type', cell: (c) => countTypeLabel(c.type) },
    { header: 'Warehouse', cell: (c) => c.warehouseName ?? c.warehouseCode ?? '—' },
    { header: 'Status', cell: statusBadge },
    { header: 'Counted', cell: progress },
    { header: 'Variance', cell: variance },
    { header: 'Started', cell: (c) => formatDate(c.startedAt) },
  ];

  const card: SelectionCard<InventoryCountRow> = {
    title: (c) => (
      <p className="truncate text-sm font-medium">
        {countTypeLabel(c.type)} · {c.warehouseName ?? c.warehouseCode ?? '—'}
      </p>
    ),
    subtitle: numberLink,
    badge: statusBadge,
    body: (c) => (
      <div className="flex flex-col gap-2">
        <div className="flex flex-row items-center justify-between gap-2">
          {progress(c)}
          <p className="text-sm font-medium">{variance(c)}</p>
        </div>
        <p className="text-base-content text-xs">started {formatDate(c.startedAt)}</p>
      </div>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(c) => c.id}
      selectable={false}
      entityLabelPlural="counts"
      getRowLabel={(c) => c.number}
      columns={columns}
      card={card}
    />
  );
}
