'use client';

// "Awaiting receipt" section — submitted/partial purchase orders, rendered
// through the shared `SelectionList` dual-view substrate (docs/34 §7) so it
// gains the Table/Cards toggle instead of the old hand-rolled flex-row list.
// Read-only selection: each row's action is "Receive", not a bulk operation.

import Link from 'next/link';
import { Badge, Button } from '@wizeworks/silicaui-react';
import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';
import {
  formatDate,
  purchaseOrderStatus,
  type PurchaseOrderRow,
} from '../../purchase-orders/_components/types';

interface AwaitingReceiptListProps {
  purchaseOrders: PurchaseOrderRow[];
  view: 'table' | 'card';
}

function outstanding(po: PurchaseOrderRow): number {
  return Math.max(0, po.quantityOrdered - po.quantityReceived);
}

function statusBadge(po: PurchaseOrderRow) {
  const s = purchaseOrderStatus(po.status);
  return (
    <Badge color={s.color} variant="soft" size="sm">
      {s.label}
    </Badge>
  );
}

function receiveButton(po: PurchaseOrderRow) {
  return (
    <Button
      color="module"
      size="sm"
      render={<Link href={`/inventory/purchase-orders/${po.id}/receive`} />}
    >
      Receive
    </Button>
  );
}

export function AwaitingReceiptList({ purchaseOrders, view }: AwaitingReceiptListProps) {
  const numberLink = (po: PurchaseOrderRow, className: string) => (
    <Link href={`/inventory/purchase-orders/${po.id}`} className={className}>
      {po.number}
    </Link>
  );

  const columns: SelectionColumn<PurchaseOrderRow>[] = [
    {
      header: 'PO',
      cell: (po) => (
        <div className="flex flex-col gap-1">
          {numberLink(po, 'font-mono text-sm hover:text-module hover:underline')}
          <p className="text-base-content/70 text-xs">
            {po.supplierName ?? po.supplierCode ?? 'Supplier'}
          </p>
        </div>
      ),
    },
    { header: 'Status', cell: statusBadge },
    {
      header: 'Warehouse',
      cell: (po) => <p className="text-sm">{po.warehouseName ?? po.warehouseCode ?? '—'}</p>,
    },
    {
      header: 'Expected',
      cell: (po) => (
        <p className="text-base-content/70 text-sm">{formatDate(po.expectedArrivalAt)}</p>
      ),
    },
    {
      header: 'Outstanding',
      align: 'right',
      cell: (po) => <p className="text-sm">{outstanding(po)}</p>,
    },
    { header: '', align: 'right', cell: receiveButton },
  ];

  const card: SelectionCard<PurchaseOrderRow> = {
    title: (po) => numberLink(po, 'font-mono text-sm hover:text-module hover:underline'),
    subtitle: (po) => (
      <p className="text-base-content/70 text-xs">
        {po.supplierName ?? po.supplierCode ?? 'Supplier'}
      </p>
    ),
    badge: statusBadge,
    body: (po) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-sm">
            {po.warehouseName ?? po.warehouseCode ?? '—'}
          </p>
          <p className="text-sm">{outstanding(po)} outstanding</p>
        </div>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-xs">exp {formatDate(po.expectedArrivalAt)}</p>
          {receiveButton(po)}
        </div>
      </>
    ),
  };

  return (
    <SelectionList
      items={purchaseOrders}
      view={view}
      getId={(po) => po.id}
      getRowLabel={(po) => po.number}
      entityLabelPlural="purchase orders"
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
