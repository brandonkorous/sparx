'use client';

import { XCircle } from 'lucide-react';
import {
  Badge,
  type BulkAction,
  SelectionList,
  type SelectionColumn,
  type SelectionCard,
  Stack,
  statusLabel,
  statusTone,
  Text,
} from '@sparx/ui';

import { bulkCancelOrdersAction } from '../../order-actions';
import { EntityRowLink } from '../../../_components/entity-row-link';

// Orders table/grid — selection + bulk actions on top of the shared
// `SelectionList` dual-view substrate (docs/34 §7). The server page renders the
// toolbar + header and passes `view`; this owns the interactive layer only.

export interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  currency: string;
  total: string | number;
  amountPaid: string | number;
  placedAt: string | null;
  channel: string | null;
}

interface OrdersSelectionTableProps {
  orders: OrderRow[];
  view: 'table' | 'card';
}

export function OrdersSelectionTable({ orders, view }: OrdersSelectionTableProps) {
  const bulkActions: BulkAction[] = [
    {
      label: 'Cancel',
      icon: XCircle,
      variant: 'destructive',
      requiresConfirm: true,
      confirmLabel:
        'Cancel {count} order{count === 1 ? "" : "s"}? Inventory is restocked and payment voids are queued. This cannot be undone.',
      onAction: async (ids) => {
        await bulkCancelOrdersAction(ids);
      },
    },
  ];

  const orderLink = (o: OrderRow, className: string) => (
    <EntityRowLink
      href={`/crm/orders/${o.id}`}
      entityType="order"
      entityId={o.id}
      className={className}
    >
      {o.orderNumber}
    </EntityRowLink>
  );

  const statusBadge = (o: OrderRow) => (
    <Badge color={statusTone(o.status)} variant="soft" size="sm">
      {statusLabel(o.status)}
    </Badge>
  );

  const paymentBadge = (o: OrderRow) => (
    <Badge color={statusTone(o.paymentStatus)} variant="soft" size="sm">
      {statusLabel(o.paymentStatus)}
    </Badge>
  );

  const totalText = (o: OrderRow) => `${o.currency} ${Number(o.total).toLocaleString()}`;
  const paidText = (o: OrderRow) =>
    Number.isNaN(Number(o.amountPaid))
      ? '—'
      : `${o.currency} ${Number(o.amountPaid).toLocaleString()}`;

  const columns: SelectionColumn<OrderRow>[] = [
    {
      header: 'Order #',
      cell: (o) =>
        orderLink(o, 'text-sm font-medium hover:text-[var(--module-active)] hover:underline'),
    },
    { header: 'Status', cell: statusBadge },
    { header: 'Payment', cell: paymentBadge },
    { header: 'Total', align: 'right', cell: totalText },
    { header: 'Paid', align: 'right', cell: paidText },
    {
      header: 'Placed',
      cell: (o) => (
        <Text size="sm" variant="muted">
          {o.placedAt ? new Date(o.placedAt).toLocaleDateString() : '—'}
        </Text>
      ),
    },
    {
      header: 'Channel',
      cell: (o) => (
        <Text size="sm" variant="muted">
          {o.channel ?? '—'}
        </Text>
      ),
    },
  ];

  const card: SelectionCard<OrderRow> = {
    title: (o) =>
      orderLink(
        o,
        'truncate text-sm font-medium hover:text-[var(--module-active)] hover:underline'
      ),
    subtitle: (o) => paymentBadge(o),
    badge: statusBadge,
    body: (o) => (
      <>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" variant="muted">
            {o.placedAt ? new Date(o.placedAt).toLocaleDateString() : '—'}
          </Text>
          <Text size="sm" className="tabular-nums">
            {totalText(o)}
          </Text>
        </Stack>
        <Text size="xs" variant="muted">
          Paid {paidText(o)}
          {o.channel ? ` · ${o.channel}` : ''}
        </Text>
      </>
    ),
  };

  return (
    <SelectionList
      items={orders}
      view={view}
      getId={(o) => o.id}
      getRowLabel={(o) => o.orderNumber}
      entityLabelPlural="orders"
      columns={columns}
      card={card}
      bulkActions={bulkActions}
    />
  );
}
