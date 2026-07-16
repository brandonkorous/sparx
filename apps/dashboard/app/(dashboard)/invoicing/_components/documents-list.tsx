'use client';

import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';
import { Badge } from '@wizeworks/silicaui-react';

import { EntityRowLink } from '../../_components/entity-row-link';
import { AR_STATUS_VARIANT, formatMoney } from './format';

// Client wrapper for the invoicing documents list. SelectionList takes render
// functions (columns/card) that can't cross the server→client boundary, so the
// server page hands serializable rows + view here and this builds both views.
// Read-only — `selectable={false}` (no checkboxes / bulk bar); rows open the
// document via EntityRowLink in the user's detail-view surface.

export interface DocumentRow {
  id: string;
  number: string | null;
  status: string;
  currency: string;
  total: string | number;
  balance: string | number;
  stageId: string;
  workflowId: string;
  updatedAt: string;
}

interface DocumentsListProps {
  items: DocumentRow[];
  view: 'table' | 'card';
  /** stageId → customer-facing label (Estimate / Invoice / Work Order). */
  stageLabels: Record<string, string>;
}

export function DocumentsList({ items, view, stageLabels }: DocumentsListProps) {
  const numberLink = (d: DocumentRow, className: string) => (
    <EntityRowLink
      href={`/invoicing/documents/${d.id}`}
      entityType="billing-document"
      entityId={d.id}
      className={className}
    >
      {d.number ?? 'Draft'}
    </EntityRowLink>
  );

  const statusBadge = (d: DocumentRow) => (
    <Badge color={AR_STATUS_VARIANT[d.status] ?? 'neutral'} className="text-xs">
      {d.status}
    </Badge>
  );

  const columns: SelectionColumn<DocumentRow>[] = [
    {
      header: 'Number',
      cell: (d) => numberLink(d, 'text-sm font-medium hover:text-module hover:underline'),
    },
    {
      header: 'Kind',
      cell: (d) => <p className="text-base-content text-sm">{stageLabels[d.stageId] ?? '—'}</p>,
    },
    { header: 'Status', cell: statusBadge },
    {
      header: 'Total',
      align: 'right',
      cell: (d) => formatMoney(d.total, d.currency),
    },
    {
      header: 'Balance',
      align: 'right',
      cell: (d) => formatMoney(d.balance, d.currency),
    },
    {
      header: 'Updated',
      cell: (d) => (
        <p className="text-base-content text-sm">{new Date(d.updatedAt).toLocaleDateString()}</p>
      ),
    },
  ];

  const card: SelectionCard<DocumentRow> = {
    title: (d) => numberLink(d, 'truncate text-sm font-medium hover:text-module hover:underline'),
    subtitle: (d) => <p className="text-base-content text-xs">{stageLabels[d.stageId] ?? '—'}</p>,
    badge: statusBadge,
    body: (d) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content text-sm">Total</p>
          <p className="text-sm tabular-nums">{formatMoney(d.total, d.currency)}</p>
        </div>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content text-sm">Balance</p>
          <p className="text-sm tabular-nums">{formatMoney(d.balance, d.currency)}</p>
        </div>
        <p className="text-base-content text-xs">
          Updated {new Date(d.updatedAt).toLocaleDateString()}
        </p>
      </>
    ),
  };

  return (
    <SelectionList
      items={items}
      view={view}
      getId={(d) => d.id}
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
