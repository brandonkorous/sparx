'use client';

import { XCircle } from 'lucide-react';
import { channelDisplayName } from '@sparx/crm-schemas';
import {
  type BulkAction,
  SelectionList,
  type SelectionColumn,
  type SelectionCard,
  statusLabel,
  statusTone,
} from '@sparx/ui';
import { Badge } from '@wizeworks/silicaui-react';

import { bulkCancelOrdersAction } from '../actions/order-actions';
import { EntityRowLink } from '../../_components/entity-row-link';
import type { OrderColumnKey } from '../lens';

// Orders table/grid — selection + bulk actions on top of the shared
// `SelectionList` dual-view substrate (docs/34 §7). The server page renders the
// toolbar + header and passes `view`; this owns the interactive layer only.
//
// Shared by all three order routes (/commerce/orders, /b2b/orders,
// /crm/orders). The lens supplies `basePath` and the column set, so each module
// gets its own view without forking this file — see ../lens.ts. Every column
// renders identically wherever it appears; only WHICH columns appear varies.

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
  /** Display name of the ordering customer. Null when the row came from the
   *  search index, which doesn't carry it. */
  customerName: string | null;
  /** Company name of the customer's B2B account, when they belong to one. */
  accountName: string | null;
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
  /** Route prefix of the owning lens — every row link is built from it, so a
   *  row can never navigate out of the module the user is working in. */
  basePath: string;
  columns: OrderColumnKey[];
}

export function OrdersSelectionTable({
  orders,
  view,
  basePath,
  columns: columnKeys,
}: OrdersSelectionTableProps) {
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
      href={`${basePath}/${o.id}`}
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
      return <p className="text-base-content text-sm">—</p>;
    }
    return (
      <Badge color={o.channel === 'marketplace' ? 'info' : 'neutral'} variant="soft" size="sm">
        {label}
      </Badge>
    );
  };

  const money = (o: OrderRow, amount: string | number) =>
    Number.isNaN(Number(amount)) ? '—' : `${o.currency} ${Number(amount).toLocaleString()}`;

  const totalText = (o: OrderRow) => money(o, o.total);
  const paidText = (o: OrderRow) => money(o, o.amountPaid);
  // What's still owed — the number the B2B receivables lens actually works from.
  const balanceText = (o: OrderRow) =>
    Number.isNaN(Number(o.amountPaid)) ? '—' : money(o, Number(o.total) - Number(o.amountPaid));

  const text = (value: string | null) => (
    <p className="text-base-content text-sm">{value ?? '—'}</p>
  );

  const dateText = (o: OrderRow) =>
    text(o.placedAt ? new Date(o.placedAt).toLocaleDateString() : null);

  const COLUMNS: Record<OrderColumnKey, SelectionColumn<OrderRow>> = {
    orderNumber: {
      header: 'Order #',
      cell: (o) => orderLink(o, 'text-sm font-medium hover:text-module hover:underline'),
    },
    customer: { header: 'Customer', cell: (o) => text(o.customerName) },
    account: { header: 'Account', cell: (o) => text(o.accountName) },
    status: { header: 'Status', cell: statusBadge },
    paymentStatus: { header: 'Payment', cell: paymentBadge },
    total: { header: 'Total', align: 'right', cell: totalText },
    paid: { header: 'Paid', align: 'right', cell: paidText },
    balance: { header: 'Balance', align: 'right', cell: balanceText },
    placedAt: { header: 'Placed', cell: dateText },
    channel: { header: 'Channel', cell: channelBadge },
  };

  const columns = columnKeys.map((key) => COLUMNS[key]);

  // The card view mirrors the lens: its secondary line shows whichever of
  // account/customer that lens leads with, so card and table tell one story.
  const partyName = (o: OrderRow) =>
    columnKeys.includes('account') ? (o.accountName ?? o.customerName) : o.customerName;

  const card: SelectionCard<OrderRow> = {
    title: (o) => orderLink(o, 'truncate text-sm font-medium hover:text-module hover:underline'),
    subtitle: (o) => paymentBadge(o),
    badge: statusBadge,
    body: (o) => (
      <>
        {partyName(o) ? <p className="text-base-content truncate text-sm">{partyName(o)}</p> : null}
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content text-sm">
            {o.placedAt ? new Date(o.placedAt).toLocaleDateString() : '—'}
          </p>
          <p className="text-sm tabular-nums">{totalText(o)}</p>
        </div>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content text-xs">
            {columnKeys.includes('balance') ? `Balance ${balanceText(o)}` : `Paid ${paidText(o)}`}
          </p>
          {columnKeys.includes('channel') && channelLabel(o) ? channelBadge(o) : null}
        </div>
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
