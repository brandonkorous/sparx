'use client';

import Link from 'next/link';
import { type SelectionCard, type SelectionColumn, SelectionList } from '@sparx/ui';

import { ApproveRejectActions } from './approve-reject-actions';

// Client wrapper for the B2B approval queue. SelectionList takes render
// functions (columns/card) which can't cross the server→client boundary, so the
// server page hands serializable rows + view and this builds both views.
// Read-only list (`selectable={false}` — no checkboxes / bulk bar); each row
// keeps its per-order approve/reject island.

interface QueuedOrder {
  id: string;
  orderNumber: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  customerId: string;
  customerName: string | null;
  customerEmail: string;
  b2bAccountId: string | null;
  companyName: string | null;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

interface ApprovalQueueListProps {
  orders: QueuedOrder[];
  view: 'table' | 'card';
}

export function ApprovalQueueList({ orders, view }: ApprovalQueueListProps) {
  const accountCell = (order: QueuedOrder) =>
    order.b2bAccountId ? (
      <Link
        href={`/b2b/accounts/${order.b2bAccountId}`}
        className="text-sm hover:text-[var(--module-active)] hover:underline"
      >
        {order.companyName ?? order.b2bAccountId}
      </Link>
    ) : (
      <p className="text-base-content/70 text-sm">—</p>
    );

  const buyerCell = (order: QueuedOrder) => (
    <div className="flex flex-col gap-1">
      <p className="text-sm">{order.customerName ?? order.customerEmail}</p>
      {order.customerName && <p className="text-base-content/70 text-xs">{order.customerEmail}</p>}
    </div>
  );

  const columns: SelectionColumn<QueuedOrder>[] = [
    {
      header: 'Order #',
      cell: (order) => <p className="text-sm font-medium tabular-nums">#{order.orderNumber}</p>,
    },
    { header: 'Account', cell: accountCell },
    { header: 'Buyer', cell: buyerCell },
    {
      header: 'Amount',
      cell: (order) => (
        <p className="text-sm font-medium tabular-nums">{formatCents(order.totalCents)}</p>
      ),
    },
    {
      header: 'Submitted',
      cell: (order) => (
        <p className="text-base-content/70 text-sm">
          {new Date(order.createdAt).toLocaleDateString()}
        </p>
      ),
    },
    {
      header: '',
      id: 'actions',
      align: 'right',
      cell: (order) => <ApproveRejectActions orderId={order.id} orderNumber={order.orderNumber} />,
    },
  ];

  const card: SelectionCard<QueuedOrder> = {
    title: (order) => (
      <p className="truncate text-sm font-medium tabular-nums">#{order.orderNumber}</p>
    ),
    subtitle: (order) => buyerCell(order),
    body: (order) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-sm">Account</p>
          {accountCell(order)}
        </div>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-sm">Amount</p>
          <p className="text-sm font-medium tabular-nums">{formatCents(order.totalCents)}</p>
        </div>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-sm">Submitted</p>
          <p className="text-base-content/70 text-sm">
            {new Date(order.createdAt).toLocaleDateString()}
          </p>
        </div>
        <ApproveRejectActions orderId={order.id} orderNumber={order.orderNumber} />
      </>
    ),
  };

  return (
    <SelectionList
      items={orders}
      view={view}
      getId={(order) => order.id}
      selectable={false}
      entityLabelPlural="orders"
      columns={columns}
      card={card}
    />
  );
}
