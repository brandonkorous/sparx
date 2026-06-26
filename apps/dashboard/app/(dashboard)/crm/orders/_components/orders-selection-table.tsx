'use client';

import { XCircle } from 'lucide-react';
import { channelDisplayName } from '@sparx/crm-schemas';
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
  /** The specific origin within the channel — for channel='marketplace', the
   *  channel slug (tiktok_shop, etsy, …) so the row badges the real marketplace. */
  source: string | null;
}

// A marketplace order badges its real channel name (TikTok Shop), not the bare
// "marketplace" bucket. Labels come from the canonical map in @sparx/crm-schemas
// (docs/106 §4.4) — never re-hardcode them here. Null channel → no badge ("—").
function channelLabel(o: OrderRow): string | null {
  return o.channel ? channelDisplayName(o.channel, o.source) : null;
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

  // Channel/source pill — marketplace orders wear an `info` tone so externally
  // sourced orders (TikTok Shop, …) stand out from native storefront/B2B orders.
  const channelBadge = (o: OrderRow) => {
    const label = channelLabel(o);
    if (!label) {
      return (
        <Text size="sm" variant="muted">
          —
        </Text>
      );
    }
    return (
      <Badge color={o.channel === 'marketplace' ? 'info' : 'neutral'} variant="soft" size="sm">
        {label}
      </Badge>
    );
  };

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
      cell: channelBadge,
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
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="xs" variant="muted">
            Paid {paidText(o)}
          </Text>
          {channelLabel(o) ? channelBadge(o) : null}
        </Stack>
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
