'use client';

import { Badge } from 'silicaui-react';
import {
  SelectionList,
  type SelectionColumn,
  type SelectionCard,
  statusLabel,
  statusTone,
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
    <Badge color={statusTone(q.status)} variant="soft" size="sm">
      {statusLabel(q.status)}
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
      quoteLink(
        q,
        'truncate text-sm font-medium hover:text-[var(--module-active)] hover:underline'
      ),
    subtitle: (q) => (
      <p className="text-base-content/70 text-xs">
        {q.validUntil ? `Valid until ${new Date(q.validUntil).toLocaleDateString()}` : 'No expiry'}
      </p>
    ),
    badge: statusBadge,
    body: (q) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-sm">
            {new Date(q.createdAt).toLocaleDateString()}
          </p>
          <p className="text-sm tabular-nums">{totalText(q)}</p>
        </div>
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
