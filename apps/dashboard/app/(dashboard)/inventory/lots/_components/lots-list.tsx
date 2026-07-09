'use client';

import Link from 'next/link';

import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';
import { Badge } from '@wizeworks/silicaui-react';

import { daysUntil, formatDate, hazmatLabel, recallBadge, type LotRow } from './types';

// Client wrapper for the lot list. SelectionList takes render functions
// (columns/card) that can't cross the server→client boundary, so the server page
// hands rows + view here. The lot number links to the lot detail.

interface LotsListProps {
  rows: LotRow[];
  view: 'table' | 'card';
}

export function LotsList({ rows, view }: LotsListProps) {
  const nowMs = Date.now();

  const lotLink = (l: LotRow) => (
    <Link href={`/inventory/lots/${l.id}`} className="hover:text-module font-mono text-xs">
      {l.lotNumber}
    </Link>
  );

  const item = (l: LotRow) => (
    <div className="flex min-w-0 flex-col gap-0">
      <p className="truncate text-sm font-medium">
        {l.productTitle ?? l.variantSku ?? l.variantId.slice(0, 8)}
      </p>
      {l.variantSku ? (
        <p className="text-base-content/70 font-mono text-xs">{l.variantSku}</p>
      ) : null}
    </div>
  );

  const expires = (l: LotRow) => {
    const days = daysUntil(l.expiresAt, nowMs);
    return (
      <div className="flex flex-col gap-0">
        <p className="text-sm">{formatDate(l.expiresAt)}</p>
        {days !== null ? (
          <p className={`text-xs ${days < 0 ? 'text-danger' : 'text-base-content/60'}`}>
            {days < 0 ? `expired ${-days}d ago` : `${days}d left`}
          </p>
        ) : null}
      </div>
    );
  };

  const hazmat = (l: LotRow) =>
    l.hazmatClass === 'none' ? (
      <p className="text-base-content/70 text-xs">none</p>
    ) : (
      <Badge color="warning" variant="soft">
        {hazmatLabel(l.hazmatClass)}
      </Badge>
    );

  const recall = (l: LotRow) => {
    const b = recallBadge(l.recallStatus);
    return b ? (
      <Badge color={b.color}>{b.label}</Badge>
    ) : (
      <p className="text-base-content/70 text-xs">—</p>
    );
  };

  const columns: SelectionColumn<LotRow>[] = [
    { header: 'Lot', cell: lotLink },
    { header: 'Item', cell: item },
    { header: 'Warehouse', cell: (l) => l.warehouseName ?? l.warehouseCode ?? '—' },
    { header: 'Qty', cell: (l) => String(l.quantity) },
    { header: 'Serials', cell: (l) => String(l.serialCount) },
    { header: 'Expires', cell: expires },
    { header: 'Hazmat', cell: hazmat },
    { header: 'Recall', cell: recall },
  ];

  const card: SelectionCard<LotRow> = {
    title: item,
    subtitle: lotLink,
    badge: (l) => {
      const b = recallBadge(l.recallStatus);
      return b ? <Badge color={b.color}>{b.label}</Badge> : null;
    },
    body: (l) => (
      <div className="flex flex-col gap-2">
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-sm">
            {l.warehouseName ?? l.warehouseCode ?? '—'}
          </p>
          <p className="text-sm">
            {l.quantity} qty · {l.serialCount} serial{l.serialCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-row items-center justify-between gap-2">
          {expires(l)}
          {hazmat(l)}
        </div>
      </div>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(l) => l.id}
      selectable={false}
      entityLabelPlural="lots"
      getRowLabel={(l) => l.lotNumber}
      columns={columns}
      card={card}
    />
  );
}
