'use client';

import { SelectionList, type SelectionCard, type SelectionColumn, Stack, Text } from '@sparx/ui';

// Client wrapper for the account-credit balances list. SelectionList takes
// render functions (columns/card) that can't cross the server→client boundary,
// so the server page hands rows + view here and this builds both views.
// Read-only — `selectable={false}` (no checkboxes / bulk bar); these balances
// have no row detail route, so there is no row link.

export interface AccountCreditCustomer {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  company: string | null;
}

export interface AccountCreditRow {
  id: string;
  customerId: string;
  balanceCents: number;
  currency: string;
  updatedAt: string;
  customer: AccountCreditCustomer | null;
}

interface AccountCreditListProps {
  balances: AccountCreditRow[];
  view: 'table' | 'card';
}

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function customerName(c: AccountCreditCustomer | null): string | null {
  if (!c) return null;
  const full = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
  return full !== '' ? full : (c.company ?? c.email ?? null);
}

export function AccountCreditList({ balances, view }: AccountCreditListProps) {
  const customerCell = (b: AccountCreditRow) => (
    <Stack gap={0}>
      <Text size="sm">{customerName(b.customer) ?? '—'}</Text>
      <Text size="xs" variant="muted">
        {b.customer?.email ?? b.customerId.slice(0, 8) + '…'}
      </Text>
    </Stack>
  );

  const columns: SelectionColumn<AccountCreditRow>[] = [
    { header: 'Customer', cell: customerCell },
    { header: 'Balance', cell: (b) => moneyFmt.format(b.balanceCents / 100) },
    {
      header: 'Currency',
      cell: (b) => <span className="font-mono text-xs">{b.currency}</span>,
    },
    {
      header: 'Updated',
      cell: (b) => (
        <Text size="xs" variant="muted">
          {new Date(b.updatedAt).toLocaleDateString()}
        </Text>
      ),
    },
  ];

  const card: SelectionCard<AccountCreditRow> = {
    title: (b) => <Text size="sm">{customerName(b.customer) ?? '—'}</Text>,
    subtitle: (b) => (
      <Text size="xs" variant="muted">
        {b.customer?.email ?? b.customerId.slice(0, 8) + '…'}
      </Text>
    ),
    badge: (b) => <span className="font-mono text-xs">{b.currency}</span>,
    body: (b) => (
      <Stack direction="row" align="center" justify="between" gap={2}>
        <Text size="sm" className="tabular-nums">
          {moneyFmt.format(b.balanceCents / 100)}
        </Text>
        <Text size="xs" variant="muted">
          updated {new Date(b.updatedAt).toLocaleDateString()}
        </Text>
      </Stack>
    ),
  };

  return (
    <SelectionList
      items={balances}
      view={view}
      getId={(b) => `${b.customerId}:${b.currency}`}
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
