'use client';

import {
  Badge,
  SelectionList,
  type SelectionColumn,
  type SelectionCard,
  Stack,
  Text,
} from '@sparx/ui';

import { EntityRowLink } from '../../../_components/entity-row-link';

// Client wrapper for the quotes list. SelectionList takes render functions
// (columns/card), which can't cross the server→client boundary, so the server
// page hands rows + view here and this builds the views. Read-only —
// `selectable={false}` (no checkboxes / bulk bar); rows open the quote detail in
// the user's detail-view surface.

export interface QuoteRow {
  id: string;
  quoteNumber: string;
  status: string;
  currency: string;
  total: string | number;
  validUntil: string | null;
  createdAt: string;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline' | 'danger'> = {
  draft: 'outline',
  submitted: 'outline',
  accepted: 'success',
  declined: 'danger',
  expired: 'warning',
  converted: 'success',
};

interface QuotesListProps {
  quotes: QuoteRow[];
  view: 'table' | 'card';
}

export function QuotesList({ quotes, view }: QuotesListProps) {
  const quoteLink = (q: QuoteRow, className: string) => (
    <EntityRowLink
      href={`/crm/quotes/${q.id}`}
      entityType="quote"
      entityId={q.id}
      className={className}
    >
      {q.quoteNumber}
    </EntityRowLink>
  );

  const statusBadge = (q: QuoteRow) => (
    <Badge color={STATUS_VARIANT[q.status] ?? 'outline'} className="text-xs">
      {q.status}
    </Badge>
  );

  const totalText = (q: QuoteRow) => `${q.currency} ${Number(q.total).toLocaleString()}`;

  const columns: SelectionColumn<QuoteRow>[] = [
    {
      header: 'Quote #',
      cell: (q) =>
        quoteLink(q, 'text-sm font-medium hover:text-[var(--module-active)] hover:underline'),
    },
    { header: 'Status', cell: statusBadge },
    { header: 'Total', align: 'right', cell: totalText },
    {
      header: 'Valid until',
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
      quoteLink(
        q,
        'truncate text-sm font-medium hover:text-[var(--module-active)] hover:underline'
      ),
    subtitle: (q) => (
      <Text size="xs" variant="muted">
        {q.validUntil ? `Valid until ${new Date(q.validUntil).toLocaleDateString()}` : 'No expiry'}
      </Text>
    ),
    badge: statusBadge,
    body: (q) => (
      <>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" variant="muted">
            {new Date(q.createdAt).toLocaleDateString()}
          </Text>
          <Text size="sm" className="tabular-nums">
            {totalText(q)}
          </Text>
        </Stack>
      </>
    ),
  };

  return (
    <SelectionList
      items={quotes}
      view={view}
      getId={(q) => q.id}
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
