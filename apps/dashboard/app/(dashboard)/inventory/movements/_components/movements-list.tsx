'use client';

import Link from 'next/link';

import { Badge } from 'silicaui-react';
import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';

import {
  actorLabel,
  formatDateTime,
  formatDelta,
  reasonColor,
  reasonLabel,
  type MovementRow,
} from './types';

// Client wrapper for the movement / audit-log list. SelectionList takes render
// functions (columns/card) that can't cross the server→client boundary, so the
// server page hands rows + view here. Read-only — the ledger is append-only. The
// item links to filter the log to that variant.

interface MovementsListProps {
  rows: MovementRow[];
  view: 'table' | 'card';
}

export function MovementsList({ rows, view }: MovementsListProps) {
  const item = (m: MovementRow) => (
    <div className="flex min-w-0 flex-col gap-0">
      <Link
        href={`/inventory/movements?variant_id=${m.variantId}${m.variantSku ? `&sku=${encodeURIComponent(m.variantSku)}` : ''}`}
        className="truncate text-sm font-medium hover:text-[var(--module-active)]"
      >
        {m.productTitle ?? m.variantSku ?? m.variantId.slice(0, 8)}
      </Link>
      {m.variantSku ? (
        <p className="text-base-content/70 font-mono text-xs">{m.variantSku}</p>
      ) : null}
    </div>
  );

  const reason = (m: MovementRow) => (
    <Badge color={reasonColor(m.reason)}>{reasonLabel(m.reason)}</Badge>
  );

  const change = (m: MovementRow) => (
    <p
      className={
        m.delta > 0
          ? 'text-sm font-medium text-[var(--color-success)]'
          : m.delta < 0
            ? 'text-sm font-medium text-[var(--color-danger)]'
            : 'text-sm font-medium'
      }
    >
      {formatDelta(m.delta)}
    </p>
  );

  const actor = (m: MovementRow) => (
    <div className="flex min-w-0 flex-col gap-0">
      <p className="text-sm">{actorLabel(m.actorType)}</p>
      {m.source ? <p className="text-base-content/70 truncate text-xs">{m.source}</p> : null}
    </div>
  );

  const reference = (m: MovementRow) =>
    m.referenceType ? (
      <p className="text-base-content/70 text-xs">{m.referenceType}</p>
    ) : (
      <p className="text-base-content/70 text-xs">—</p>
    );

  const columns: SelectionColumn<MovementRow>[] = [
    { header: 'When', cell: (m) => formatDateTime(m.createdAt) },
    { header: 'Item', cell: item },
    { header: 'Location', cell: (m) => m.warehouseName ?? m.warehouseCode ?? '—' },
    { header: 'Reason', cell: reason },
    { header: 'Change', cell: change },
    { header: 'Balance', cell: (m) => (m.balanceAfter === null ? '—' : String(m.balanceAfter)) },
    { header: 'Actor', cell: actor },
    { header: 'Reference', cell: reference },
  ];

  const card: SelectionCard<MovementRow> = {
    title: item,
    badge: reason,
    subtitle: (m) => <p className="text-base-content/70 text-xs">{formatDateTime(m.createdAt)}</p>,
    body: (m) => (
      <div className="flex flex-col gap-2">
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-sm">
            {m.warehouseName ?? m.warehouseCode ?? '—'}
          </p>
          <div className="flex flex-row items-center gap-2">
            {change(m)}
            <p className="text-base-content/70 text-xs">bal {m.balanceAfter ?? '—'}</p>
          </div>
        </div>
        <p className="text-base-content/70 text-xs">
          {actorLabel(m.actorType)}
          {m.referenceType ? ` · ${m.referenceType}` : ''}
        </p>
      </div>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(m) => m.id}
      selectable={false}
      entityLabelPlural="movements"
      getRowLabel={(m) => `${reasonLabel(m.reason)} ${formatDelta(m.delta)}`}
      columns={columns}
      card={card}
    />
  );
}
