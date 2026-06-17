'use client';

import Link from 'next/link';

import {
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Badge,
  Stack,
  Text,
} from '@sparx/ui';

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
    <Text size="xs" variant="muted">
      {po.lineCount} line{po.lineCount === 1 ? '' : 's'}
      {po.quantityOrdered > 0 ? ` · ${po.quantityReceived}/${po.quantityOrdered} recv` : ''}
    </Text>
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
      <Text size="sm" className="truncate font-medium">
        {po.supplierName ?? po.supplierCode ?? 'Supplier'}
      </Text>
    ),
    subtitle: numberLink,
    badge: statusBadge,
    body: (po) => (
      <Stack gap={2}>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="xs" variant="muted">
            {po.warehouseName ?? po.warehouseCode ?? '—'}
          </Text>
          <Text size="sm" className="font-medium">
            {formatMoney(po.totalCents, po.currency)}
          </Text>
        </Stack>
        <Stack direction="row" align="center" justify="between" gap={2}>
          {lines(po)}
          <Text size="xs" variant="muted">
            exp {formatDate(po.expectedArrivalAt)}
          </Text>
        </Stack>
      </Stack>
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
