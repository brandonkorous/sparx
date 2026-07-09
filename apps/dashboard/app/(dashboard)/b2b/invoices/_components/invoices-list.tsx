'use client';

import Link from 'next/link';
import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';
import { Badge } from '@wizeworks/silicaui-react';

// Client wrapper for the B2B invoices list. SelectionList takes render
// functions (columns/card), which can't cross the server→client boundary, so
// the server page hands rows + view here and this builds both views. Read-only —
// `selectable={false}` (no checkboxes / bulk bar). Rows open the invoice (and
// the account) via plain links.

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  status: string;
  amountCents: number;
  balanceCents: number;
  overdueDays: number;
  dueAt: string;
  paidAt: string | null;
  createdAt: string;
  account: { id: string; companyName: string } | null;
}

const STATUS_VARIANT: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
  unpaid: 'neutral',
  partial: 'warning',
  overdue: 'danger',
  paid: 'success',
  void: 'neutral',
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

interface InvoicesListProps {
  invoices: InvoiceRow[];
  view: 'table' | 'card';
}

export function InvoicesList({ invoices, view }: InvoicesListProps) {
  const invoiceLink = (inv: InvoiceRow, className: string) => (
    <Link href={`/b2b/invoices/${inv.id}`} className={className}>
      {inv.invoiceNumber}
    </Link>
  );

  const accountCell = (inv: InvoiceRow) =>
    inv.account ? (
      <Link
        href={`/b2b/accounts/${inv.account.id}`}
        className="hover:text-module text-sm hover:underline"
      >
        {inv.account.companyName}
      </Link>
    ) : (
      <p className="text-base-content/70 text-sm">—</p>
    );

  const statusBadge = (inv: InvoiceRow) => (
    <Badge color={STATUS_VARIANT[inv.status] ?? 'neutral'} variant="soft" size="sm">
      {inv.status.replace('_', ' ')}
    </Badge>
  );

  const columns: SelectionColumn<InvoiceRow>[] = [
    {
      header: 'Invoice #',
      cell: (inv) => invoiceLink(inv, 'font-medium hover:text-module hover:underline'),
    },
    { header: 'Account', cell: accountCell },
    { header: 'Status', cell: statusBadge },
    {
      header: 'Amount',
      cell: (inv) => <p className="text-sm tabular-nums">{formatCents(inv.amountCents)}</p>,
    },
    {
      header: 'Due',
      cell: (inv) => (
        <p className={`text-sm ${inv.status === 'overdue' ? 'text-danger' : ''}`}>
          {new Date(inv.dueAt).toLocaleDateString()}
        </p>
      ),
    },
    {
      header: 'Overdue days',
      cell: (inv) => (
        <p className={inv.overdueDays > 0 ? 'text-sm' : 'text-base-content/70 text-sm'}>
          {inv.overdueDays > 0 ? `${inv.overdueDays}d` : '—'}
        </p>
      ),
    },
    {
      header: 'Paid',
      cell: (inv) => (
        <p className="text-base-content/70 text-sm">
          {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '—'}
        </p>
      ),
    },
  ];

  const card: SelectionCard<InvoiceRow> = {
    title: (inv) => invoiceLink(inv, 'truncate font-medium hover:text-module hover:underline'),
    subtitle: (inv) =>
      inv.account ? (
        <Link
          href={`/b2b/accounts/${inv.account.id}`}
          className="text-base-content/70 hover:text-module truncate text-xs hover:underline"
        >
          {inv.account.companyName}
        </Link>
      ) : null,
    badge: statusBadge,
    body: (inv) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-xs">Amount</p>
          <p className="text-sm tabular-nums">{formatCents(inv.amountCents)}</p>
        </div>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-xs">Due</p>
          <p className={`text-sm ${inv.status === 'overdue' ? 'text-danger' : ''}`}>
            {new Date(inv.dueAt).toLocaleDateString()}
            {inv.overdueDays > 0 ? ` · ${inv.overdueDays}d overdue` : ''}
          </p>
        </div>
        <p className="text-base-content/70 text-xs">
          {inv.paidAt ? `Paid ${new Date(inv.paidAt).toLocaleDateString()}` : 'Unpaid'}
        </p>
      </>
    ),
  };

  return (
    <SelectionList
      items={invoices}
      view={view}
      getId={(inv) => inv.id}
      selectable={false}
      getRowLabel={(inv) => inv.invoiceNumber}
      entityLabelPlural="invoices"
      columns={columns}
      card={card}
    />
  );
}
