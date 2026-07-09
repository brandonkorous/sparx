'use client';

import { Badge } from '@wizeworks/silicaui-react';
import { SelectionList, type SelectionCard, type SelectionColumn, statusLabel } from '@sparx/ui';

import { EntityRowLink } from '../../../_components/entity-row-link';

// Client wrapper for the Carts diagnostic list. SelectionList takes render
// functions (columns/card), which can't cross the server→client boundary, so
// the server page hands rows + view here and this builds the views. Read-only —
// `selectable={false}` (no checkboxes / bulk bar); rows open the cart inspector
// via EntityRowLink in the user's detail-view surface.

interface CartCustomer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  company: string | null;
}

export interface CartRow {
  id: string;
  channel: string;
  currency: string;
  customerId: string | null;
  guestToken: string | null;
  subtotalCents: number;
  totalCents: number;
  itemCount: number;
  abandonedAt: string | null;
  recoveredAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
  customer: CartCustomer | null;
}

interface CartsListProps {
  rows: CartRow[];
  view: 'table' | 'card';
}

function customerName(c: CartCustomer | null): string | null {
  if (!c) return null;
  const full = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
  return full !== '' ? full : (c.email ?? null);
}

export function CartsList({ rows, view }: CartsListProps) {
  const idLink = (c: CartRow) => (
    <EntityRowLink
      href={`/commerce/carts/${c.id}`}
      entityType="cart"
      entityId={c.id}
      className="hover:text-module font-mono text-xs"
    >
      {c.id.slice(0, 8)}
    </EntityRowLink>
  );

  const customerCell = (c: CartRow) => {
    const displayName = customerName(c.customer);
    return c.customer?.email ? (
      <div className="flex flex-col gap-0">
        <p className="text-sm">{displayName ?? c.customer.email}</p>
        {displayName && displayName !== c.customer.email && (
          <p className="text-base-content/70 text-xs">{c.customer.email}</p>
        )}
      </div>
    ) : c.guestToken ? (
      <p className="text-base-content/70 text-xs">guest</p>
    ) : (
      <>—</>
    );
  };

  const lifecycleBadge = (c: CartRow) =>
    c.recoveredAt ? (
      <Badge color="success" variant="soft" size="sm">
        recovered
      </Badge>
    ) : c.abandonedAt ? (
      <Badge color="warning" variant="soft" size="sm">
        abandoned
      </Badge>
    ) : (
      <Badge color="info" variant="soft" size="sm">
        active
      </Badge>
    );

  const totalLabel = (c: CartRow) => `$${(c.totalCents / 100).toFixed(2)} ${c.currency}`;

  const columns: SelectionColumn<CartRow>[] = [
    { header: 'ID', cell: idLink },
    { header: 'Customer', cell: customerCell },
    {
      header: 'Channel',
      cell: (c) => (
        <Badge color="neutral" variant="soft" size="sm">
          {statusLabel(c.channel)}
        </Badge>
      ),
    },
    { header: 'Items', cell: (c) => <>{c.itemCount}</> },
    { header: 'Total', cell: (c) => <>{totalLabel(c)}</> },
    { header: 'Last activity', cell: (c) => <>{new Date(c.updatedAt).toLocaleString()}</> },
    { header: 'Lifecycle', cell: lifecycleBadge },
  ];

  const card: SelectionCard<CartRow> = {
    title: (c) => idLink(c),
    subtitle: (c) => {
      const displayName = customerName(c.customer);
      const label = displayName ?? c.customer?.email ?? (c.guestToken ? 'guest' : '—');
      return <p className="text-base-content/70 text-xs">{label}</p>;
    },
    badge: lifecycleBadge,
    body: (c) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          <Badge color="neutral" variant="soft" size="sm">
            {statusLabel(c.channel)}
          </Badge>
          <p className="text-sm tabular-nums">{totalLabel(c)}</p>
        </div>
        <p className="text-base-content/70 text-xs">
          {c.itemCount} item{c.itemCount === 1 ? '' : 's'} ·{' '}
          {new Date(c.updatedAt).toLocaleString()}
        </p>
      </>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(c) => c.id}
      getRowLabel={(c) => c.id.slice(0, 8)}
      entityLabelPlural="carts"
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
