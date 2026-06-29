'use client';

import Link from 'next/link';
import {
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Badge,
  Stack,
  Text,
} from '@sparx/ui';

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

const STATUS_VARIANT: Record<string, 'outline' | 'warning' | 'success' | 'danger'> = {
  unpaid: 'outline',
  partial: 'warning',
  overdue: 'danger',
  paid: 'success',
  void: 'outline',
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
        className="text-sm hover:text-[var(--module-active)] hover:underline"
      >
        {inv.account.companyName}
      </Link>
    ) : (
      <Text size="sm" variant="muted">
        —
      </Text>
    );

  const statusBadge = (inv: InvoiceRow) => (
    <Badge color={STATUS_VARIANT[inv.status] ?? 'neutral'} variant="soft" size="sm">
      {inv.status.replace('_', ' ')}
    </Badge>
  );

  const columns: SelectionColumn<InvoiceRow>[] = [
    {
      header: 'Invoice #',
      cell: (inv) =>
        invoiceLink(inv, 'font-medium hover:text-[var(--module-active)] hover:underline'),
    },
    { header: 'Account', cell: accountCell },
    { header: 'Status', cell: statusBadge },
    {
      header: 'Amount',
      cell: (inv) => (
        <Text size="sm" className="tabular-nums">
          {formatCents(inv.amountCents)}
        </Text>
      ),
    },
    {
      header: 'Due',
      cell: (inv) => (
        <Text size="sm" className={inv.status === 'overdue' ? 'text-[var(--color-danger)]' : ''}>
          {new Date(inv.dueAt).toLocaleDateString()}
        </Text>
      ),
    },
    {
      header: 'Overdue days',
      cell: (inv) => (
        <Text size="sm" variant={inv.overdueDays > 0 ? 'default' : 'muted'}>
          {inv.overdueDays > 0 ? `${inv.overdueDays}d` : '—'}
        </Text>
      ),
    },
    {
      header: 'Paid',
      cell: (inv) => (
        <Text size="sm" variant="muted">
          {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '—'}
        </Text>
      ),
    },
  ];

  const card: SelectionCard<InvoiceRow> = {
    title: (inv) =>
      invoiceLink(inv, 'truncate font-medium hover:text-[var(--module-active)] hover:underline'),
    subtitle: (inv) =>
      inv.account ? (
        <Link
          href={`/b2b/accounts/${inv.account.id}`}
          className="truncate text-xs text-[var(--color-text-secondary)] hover:text-[var(--module-active)] hover:underline"
        >
          {inv.account.companyName}
        </Link>
      ) : null,
    badge: statusBadge,
    body: (inv) => (
      <>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="xs" variant="muted">
            Amount
          </Text>
          <Text size="sm" className="tabular-nums">
            {formatCents(inv.amountCents)}
          </Text>
        </Stack>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="xs" variant="muted">
            Due
          </Text>
          <Text size="sm" className={inv.status === 'overdue' ? 'text-[var(--color-danger)]' : ''}>
            {new Date(inv.dueAt).toLocaleDateString()}
            {inv.overdueDays > 0 ? ` · ${inv.overdueDays}d overdue` : ''}
          </Text>
        </Stack>
        <Text size="xs" variant="muted">
          {inv.paidAt ? `Paid ${new Date(inv.paidAt).toLocaleDateString()}` : 'Unpaid'}
        </Text>
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
