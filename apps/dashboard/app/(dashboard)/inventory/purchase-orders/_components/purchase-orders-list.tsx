'use client';

import Link from 'next/link';

import { Badge } from 'silicaui-react';
import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';

import { formatDate, formatMoney, purchaseOrderStatus, type PurchaseOrderRow } from './types';

// Client wrapper for the purchase-order list. SelectionList takes render
// functions (columns/card) that can't cross the server→client boundary, so the
// server page hands rows + view here. Read-only; the number links to the PO
// detail (page-based, not an overlay).

interface PurchaseOrdersListProps {
  rows: PurchaseOrderRow[];
  view: 'table' | 'card';
}

export function PurchaseOrdersList({ rows, view }: PurchaseOrdersListProps) {
  const numberLink = (po: PurchaseOrderRow) => (
    <Link
      href={`/inventory/purchase-orders/${po.id}`}
      className="font-mono text-xs hover:text-[var(--module-active)]"
    >
      {po.number}
    </Link>
  );

  const statusBadge = (po: PurchaseOrderRow) => {
    const s = purchaseOrderStatus(po.status);
    return <Badge color={s.color}>{s.label}</Badge>;
  };

  const lines = (po: PurchaseOrderRow) => (
    <p className="text-base-content/70 text-xs">
      {po.lineCount} line{po.lineCount === 1 ? '' : 's'}
      {po.quantityOrdered > 0 ? ` · ${po.quantityReceived}/${po.quantityOrdered} recv` : ''}
    </p>
  );

  const columns: SelectionColumn<PurchaseOrderRow>[] = [
    { header: 'Number', cell: numberLink },
    { header: 'Supplier', cell: (po) => po.supplierName ?? po.supplierCode ?? '—' },
    { header: 'Warehouse', cell: (po) => po.warehouseName ?? po.warehouseCode ?? '—' },
    { header: 'Status', cell: statusBadge },
    { header: 'Lines', cell: lines },
    { header: 'Total', cell: (po) => formatMoney(po.totalCents, po.currency) },
    { header: 'Expected', cell: (po) => formatDate(po.expectedArrivalAt) },
  ];

  const card: SelectionCard<PurchaseOrderRow> = {
    title: (po) => (
      <p className="truncate text-sm font-medium">
        {po.supplierName ?? po.supplierCode ?? 'Supplier'}
      </p>
    ),
    subtitle: numberLink,
    badge: statusBadge,
    body: (po) => (
      <div className="flex flex-col gap-2">
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-xs">
            {po.warehouseName ?? po.warehouseCode ?? '—'}
          </p>
          <p className="text-sm font-medium">{formatMoney(po.totalCents, po.currency)}</p>
        </div>
        <div className="flex flex-row items-center justify-between gap-2">
          {lines(po)}
          <p className="text-base-content/70 text-xs">exp {formatDate(po.expectedArrivalAt)}</p>
        </div>
      </div>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(po) => po.id}
      selectable={false}
      entityLabelPlural="purchase orders"
      getRowLabel={(po) => po.number}
      columns={columns}
      card={card}
    />
  );
}
