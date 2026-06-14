'use client';

import {
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Badge,
  Stack,
  Text,
} from '@sparx/ui';

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
      className="font-mono text-xs hover:text-[var(--module-active)]"
    >
      {c.id.slice(0, 8)}
    </EntityRowLink>
  );

  const customerCell = (c: CartRow) => {
    const displayName = customerName(c.customer);
    return c.customer?.email ? (
      <Stack gap={0}>
        <Text size="sm">{displayName ?? c.customer.email}</Text>
        {displayName && displayName !== c.customer.email && (
          <Text size="xs" variant="muted">
            {c.customer.email}
          </Text>
        )}
      </Stack>
    ) : c.guestToken ? (
      <Text size="xs" variant="muted">
        guest
      </Text>
    ) : (
      <>—</>
    );
  };

  const lifecycleBadge = (c: CartRow) =>
    c.recoveredAt ? (
      <Badge color="success">recovered</Badge>
    ) : c.abandonedAt ? (
      <Badge color="warning">abandoned</Badge>
    ) : (
      <Badge variant="outline">active</Badge>
    );

  const totalLabel = (c: CartRow) => `$${(c.totalCents / 100).toFixed(2)} ${c.currency}`;

  const columns: SelectionColumn<CartRow>[] = [
    { header: 'ID', cell: idLink },
    { header: 'Customer', cell: customerCell },
    { header: 'Channel', cell: (c) => <Badge variant="outline">{c.channel}</Badge> },
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
      return (
        <Text size="xs" variant="muted">
          {label}
        </Text>
      );
    },
    badge: lifecycleBadge,
    body: (c) => (
      <>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Badge variant="outline">{c.channel}</Badge>
          <Text size="sm" className="tabular-nums">
            {totalLabel(c)}
          </Text>
        </Stack>
        <Text size="xs" variant="muted">
          {c.itemCount} item{c.itemCount === 1 ? '' : 's'} ·{' '}
          {new Date(c.updatedAt).toLocaleString()}
        </Text>
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
