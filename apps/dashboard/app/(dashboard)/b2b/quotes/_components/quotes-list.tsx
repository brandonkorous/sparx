'use client';

import Link from 'next/link';
import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';
import { Badge } from 'silicaui-react';

// Client wrapper for the B2B quotes / RFQ list. SelectionList takes render
// functions (columns/card), which can't cross the server→client boundary, so
// the server page hands rows + view here and this builds both views. Read-only —
// `selectable={false}` (no checkboxes / bulk bar). Rows open the quote (and the
// account) via plain links.

export interface QuoteRow {
  id: string;
  quoteNumber: string;
  status: string;
  validUntil: string | null;
  total: string | number;
  createdAt: string;
  b2bAccount: { id: string; companyName: string } | null;
  _count: { items: number };
}

const STATUS_VARIANT: Record<string, 'neutral' | 'warning' | 'success' | 'danger' | 'module'> = {
  draft: 'neutral',
  submitted: 'warning',
  under_review: 'warning',
  quoted: 'module',
  accepted: 'success',
  declined: 'danger',
  expired: 'neutral',
};

function formatTotal(total: string | number): string {
  return `$${Number(total).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

interface QuotesListProps {
  quotes: QuoteRow[];
  view: 'table' | 'card';
}

export function QuotesList({ quotes, view }: QuotesListProps) {
  const quoteLink = (q: QuoteRow, className: string) => (
    <Link href={`/b2b/quotes/${q.id}`} className={className}>
      {q.quoteNumber}
    </Link>
  );

  const accountCell = (q: QuoteRow) =>
    q.b2bAccount ? (
      <Link
        href={`/b2b/accounts/${q.b2bAccount.id}`}
        className="text-sm hover:text-[var(--module-active)] hover:underline"
      >
        {q.b2bAccount.companyName}
      </Link>
    ) : (
      <p className="text-base-content/70 text-sm">—</p>
    );

  const statusBadge = (q: QuoteRow) => (
    <Badge color={STATUS_VARIANT[q.status] ?? 'neutral'} variant="soft" size="sm">
      {q.status.replace('_', ' ')}
    </Badge>
  );

  const columns: SelectionColumn<QuoteRow>[] = [
    {
      header: 'Quote #',
      cell: (q) => quoteLink(q, 'font-medium hover:text-[var(--module-active)] hover:underline'),
    },
    { header: 'Account', cell: accountCell },
    { header: 'Status', cell: statusBadge },
    { header: 'Items', cell: (q) => <p className="text-sm">{q._count.items}</p> },
    { header: 'Total', cell: (q) => <p className="text-sm">{formatTotal(q.total)}</p> },
    {
      header: 'Expires',
      cell: (q) => (
        <p className="text-base-content/70 text-sm">
          {q.validUntil ? new Date(q.validUntil).toLocaleDateString() : '—'}
        </p>
      ),
    },
    {
      header: 'Created',
      cell: (q) => (
        <p className="text-base-content/70 text-sm">{new Date(q.createdAt).toLocaleDateString()}</p>
      ),
    },
  ];

  const card: SelectionCard<QuoteRow> = {
    title: (q) =>
      quoteLink(q, 'truncate font-medium hover:text-[var(--module-active)] hover:underline'),
    subtitle: (q) =>
      q.b2bAccount ? (
        <Link
          href={`/b2b/accounts/${q.b2bAccount.id}`}
          className="truncate text-xs text-[var(--color-text-secondary)] hover:text-[var(--module-active)] hover:underline"
        >
          {q.b2bAccount.companyName}
        </Link>
      ) : null,
    badge: statusBadge,
    body: (q) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-sm">
            {q._count.items} item{q._count.items === 1 ? '' : 's'}
          </p>
          <p className="text-sm tabular-nums">{formatTotal(q.total)}</p>
        </div>
        <p className="text-base-content/70 text-xs">
          {q.validUntil ? `Expires ${new Date(q.validUntil).toLocaleDateString()} · ` : ''}created{' '}
          {new Date(q.createdAt).toLocaleDateString()}
        </p>
      </>
    ),
  };

  return (
    <SelectionList
      items={quotes}
      view={view}
      getId={(q) => q.id}
      selectable={false}
      getRowLabel={(q) => q.quoteNumber}
      entityLabelPlural="quotes"
      columns={columns}
      card={card}
    />
  );
}
