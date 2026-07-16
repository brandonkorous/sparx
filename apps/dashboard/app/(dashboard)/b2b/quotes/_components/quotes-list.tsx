'use client';

import { SelectionList, type SelectionCard, type SelectionColumn } from '@sparx/ui';
import { Badge } from '@wizeworks/silicaui-react';

import { EntityRowLink } from '../../../_components/entity-row-link';

// Client wrapper for the B2B quotes / RFQ list. A quote IS a BillingDocument on
// the system `b2b-quotes` workflow (docs/87 convergence) — there is no separate
// B2B quote detail page; rows open the underlying document via the Invoicing
// detail surface. Read-only — `selectable={false}` (no checkboxes / bulk bar).

export interface QuoteRow {
  id: string;
  number: string | null;
  total: string | number;
  currency: string;
  validUntil: string | null;
  createdAt: string;
  stage: { name: string; customerLabel: string; stageType: string };
  account: { id: string; companyName: string } | null;
  customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
}

// The seeded default stage names get a precise tone; a tenant that renames a
// stage falls back to a tone by its stageType (draft/committed/void).
const STAGE_TONE: Record<string, 'neutral' | 'warning' | 'module' | 'success' | 'danger'> = {
  Draft: 'neutral',
  Submitted: 'warning',
  'Under Review': 'warning',
  Quoted: 'module',
  Accepted: 'success',
  Declined: 'danger',
  Expired: 'neutral',
};
const STAGE_TYPE_TONE: Record<string, 'neutral' | 'warning' | 'module' | 'success' | 'danger'> = {
  draft: 'warning',
  committed: 'success',
  void: 'danger',
};

function formatTotal(total: string | number, currency: string): string {
  return Number(total).toLocaleString('en-US', { style: 'currency', currency });
}

function partyLabel(q: QuoteRow): string {
  if (q.account) return q.account.companyName;
  if (q.customer) {
    const name = [q.customer.firstName, q.customer.lastName].filter(Boolean).join(' ');
    return name || (q.customer.email ?? '—');
  }
  return '—';
}

interface QuotesListProps {
  quotes: QuoteRow[];
  view: 'table' | 'card';
}

export function QuotesList({ quotes, view }: QuotesListProps) {
  const numberLink = (q: QuoteRow, className: string) => (
    <EntityRowLink
      href={`/invoicing/documents/${q.id}`}
      entityType="billing-document"
      entityId={q.id}
      className={className}
    >
      {q.number ?? 'Draft'}
    </EntityRowLink>
  );

  const stageBadge = (q: QuoteRow) => (
    <Badge
      color={STAGE_TONE[q.stage.name] ?? STAGE_TYPE_TONE[q.stage.stageType] ?? 'neutral'}
      variant="soft"
      size="sm"
    >
      {q.stage.customerLabel}
    </Badge>
  );

  const columns: SelectionColumn<QuoteRow>[] = [
    {
      header: 'Quote #',
      cell: (q) => numberLink(q, 'font-medium hover:text-module hover:underline'),
    },
    { header: 'Account', cell: (q) => <p className="text-sm">{partyLabel(q)}</p> },
    { header: 'Stage', cell: stageBadge },
    { header: 'Total', cell: (q) => <p className="text-sm">{formatTotal(q.total, q.currency)}</p> },
    {
      header: 'Expires',
      cell: (q) => (
        <p className="text-base-content text-sm">
          {q.validUntil ? new Date(q.validUntil).toLocaleDateString() : '—'}
        </p>
      ),
    },
    {
      header: 'Created',
      cell: (q) => (
        <p className="text-base-content text-sm">{new Date(q.createdAt).toLocaleDateString()}</p>
      ),
    },
  ];

  const card: SelectionCard<QuoteRow> = {
    title: (q) => numberLink(q, 'truncate font-medium hover:text-module hover:underline'),
    subtitle: (q) => <p className="text-base-content truncate text-xs">{partyLabel(q)}</p>,
    badge: stageBadge,
    body: (q) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content text-sm">Total</p>
          <p className="text-sm tabular-nums">{formatTotal(q.total, q.currency)}</p>
        </div>
        <p className="text-base-content text-xs">
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
      getRowLabel={(q) => q.number ?? 'Draft'}
      entityLabelPlural="quotes"
      columns={columns}
      card={card}
    />
  );
}
