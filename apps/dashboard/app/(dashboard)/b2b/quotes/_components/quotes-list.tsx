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

const STATUS_VARIANT: Record<string, 'outline' | 'warning' | 'success' | 'danger' | 'module'> = {
  draft: 'outline',
  submitted: 'warning',
  under_review: 'warning',
  quoted: 'module',
  accepted: 'success',
  declined: 'danger',
  expired: 'outline',
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
      <Text size="sm" variant="muted">
        —
      </Text>
    );

  const statusBadge = (q: QuoteRow) => (
    <Badge color={STATUS_VARIANT[q.status] ?? 'outline'} variant="soft">
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
    { header: 'Items', cell: (q) => <Text size="sm">{q._count.items}</Text> },
    { header: 'Total', cell: (q) => <Text size="sm">{formatTotal(q.total)}</Text> },
    {
      header: 'Expires',
      cell: (q) => (
        <Text size="sm" variant="muted">
          {q.validUntil ? new Date(q.validUntil).toLocaleDateString() : '—'}
        </Text>
      ),
    },
    {
      header: 'Created',
      cell: (q) => (
        <Text size="sm" variant="muted">
          {new Date(q.createdAt).toLocaleDateString()}
        </Text>
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
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" variant="muted">
            {q._count.items} item{q._count.items === 1 ? '' : 's'}
          </Text>
          <Text size="sm" className="tabular-nums">
            {formatTotal(q.total)}
          </Text>
        </Stack>
        <Text size="xs" variant="muted">
          {q.validUntil ? `Expires ${new Date(q.validUntil).toLocaleDateString()} · ` : ''}created{' '}
          {new Date(q.createdAt).toLocaleDateString()}
        </Text>
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
