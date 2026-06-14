'use client';

import Link from 'next/link';
import { type SelectionCard, type SelectionColumn, SelectionList, Stack, Text } from '@sparx/ui';

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
      <Text size="sm" variant="muted">
        —
      </Text>
    );

  const buyerCell = (order: QueuedOrder) => (
    <Stack gap={1}>
      <Text size="sm">{order.customerName ?? order.customerEmail}</Text>
      {order.customerName && (
        <Text size="xs" variant="muted">
          {order.customerEmail}
        </Text>
      )}
    </Stack>
  );

  const columns: SelectionColumn<QueuedOrder>[] = [
    {
      header: 'Order #',
      cell: (order) => (
        <Text size="sm" className="font-medium tabular-nums">
          #{order.orderNumber}
        </Text>
      ),
    },
    { header: 'Account', cell: accountCell },
    { header: 'Buyer', cell: buyerCell },
    {
      header: 'Amount',
      cell: (order) => (
        <Text size="sm" className="font-medium tabular-nums">
          {formatCents(order.totalCents)}
        </Text>
      ),
    },
    {
      header: 'Submitted',
      cell: (order) => (
        <Text size="sm" variant="muted">
          {new Date(order.createdAt).toLocaleDateString()}
        </Text>
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
      <Text size="sm" className="truncate font-medium tabular-nums">
        #{order.orderNumber}
      </Text>
    ),
    subtitle: (order) => buyerCell(order),
    body: (order) => (
      <>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" variant="muted">
            Account
          </Text>
          {accountCell(order)}
        </Stack>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" variant="muted">
            Amount
          </Text>
          <Text size="sm" className="font-medium tabular-nums">
            {formatCents(order.totalCents)}
          </Text>
        </Stack>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" variant="muted">
            Submitted
          </Text>
          <Text size="sm" variant="muted">
            {new Date(order.createdAt).toLocaleDateString()}
          </Text>
        </Stack>
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
