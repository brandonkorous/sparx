'use client';

import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';

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
    <div className="flex flex-col gap-0">
      <p className="text-sm">{customerName(b.customer) ?? '—'}</p>
      <p className="text-base-content text-xs">
        {b.customer?.email ?? b.customerId.slice(0, 8) + '…'}
      </p>
    </div>
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
        <p className="text-base-content text-xs">{new Date(b.updatedAt).toLocaleDateString()}</p>
      ),
    },
  ];

  const card: SelectionCard<AccountCreditRow> = {
    title: (b) => <p className="text-sm">{customerName(b.customer) ?? '—'}</p>,
    subtitle: (b) => (
      <p className="text-base-content text-xs">
        {b.customer?.email ?? b.customerId.slice(0, 8) + '…'}
      </p>
    ),
    badge: (b) => <span className="font-mono text-xs">{b.currency}</span>,
    body: (b) => (
      <div className="flex flex-row items-center justify-between gap-2">
        <p className="text-sm tabular-nums">{moneyFmt.format(b.balanceCents / 100)}</p>
        <p className="text-base-content text-xs">
          updated {new Date(b.updatedAt).toLocaleDateString()}
        </p>
      </div>
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
