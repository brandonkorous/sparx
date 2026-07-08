'use client';

import {
  type SelectionCard,
  type SelectionColumn,
  SelectionList,
  statusLabel,
  statusTone,
} from '@sparx/ui';
import { Badge } from 'silicaui-react';

import { EntityRowLink } from '../../../_components/entity-row-link';

// Client wrapper for the subscriptions list. SelectionList takes render
// functions (columns/card), which can't cross the server→client boundary, so
// the server page hands rows + view here and this builds both views. Read-only —
// `selectable={false}` (no checkboxes / bulk bar); pause / skip / cancel actions
// live on the detail page, opened via EntityRowLink in the detail-view surface.

type SubscriptionStatus = 'active' | 'trialing' | 'paused' | 'past_due' | 'cancelled';

export interface SubscriptionSummary {
  id: string;
  customerId: string;
  customerName: string | null;
  status: SubscriptionStatus;
  nextOccurrenceAt: string | null;
  itemCount: number;
  monthlyRecurringRevenueCents: number;
  currency: string;
  providerSlug: string;
}

interface SubscriptionsListProps {
  items: SubscriptionSummary[];
  view: 'table' | 'card';
}

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  return (
    <Badge color={statusTone(status)} variant="soft" size="sm">
      {statusLabel(status)}
    </Badge>
  );
}

function mrr(s: SubscriptionSummary): string {
  return `$${(s.monthlyRecurringRevenueCents / 100).toFixed(2)} ${s.currency}`;
}

function nextCharge(s: SubscriptionSummary): string {
  return s.nextOccurrenceAt ? new Date(s.nextOccurrenceAt).toLocaleDateString() : '—';
}

export function SubscriptionsList({ items, view }: SubscriptionsListProps) {
  const idLink = (s: SubscriptionSummary, className: string) => (
    <EntityRowLink
      href={`/commerce/subscriptions/${s.id}`}
      entityType="subscription"
      entityId={s.id}
      className={className}
    >
      {s.id.slice(0, 8)}
    </EntityRowLink>
  );

  const columns: SelectionColumn<SubscriptionSummary>[] = [
    {
      header: 'ID',
      cell: (s) => idLink(s, 'font-mono text-xs hover:text-[var(--module-active)]'),
    },
    {
      header: 'Customer',
      cell: (s) =>
        s.customerName ? (
          <p className="text-sm">{s.customerName}</p>
        ) : (
          <p className="text-base-content/70 font-mono text-xs">{s.customerId.slice(0, 8)}</p>
        ),
    },
    { header: 'Items', cell: (s) => s.itemCount },
    { header: 'Status', cell: (s) => <StatusBadge status={s.status} /> },
    { header: 'Next charge', cell: (s) => nextCharge(s) },
    { header: 'MRR', cell: (s) => mrr(s) },
    {
      header: 'Provider',
      cell: (s) => <p className="font-mono text-xs">{s.providerSlug}</p>,
    },
  ];

  const card: SelectionCard<SubscriptionSummary> = {
    title: (s) => idLink(s, 'truncate font-mono text-sm hover:text-[var(--module-active)]'),
    subtitle: (s) => (
      <p className={`text-xs text-base-content/70${s.customerName ? '' : 'font-mono'}`}>
        {s.customerName ?? s.customerId.slice(0, 8)}
      </p>
    ),
    badge: (s) => <StatusBadge status={s.status} />,
    body: (s) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          <p className="text-base-content/70 text-sm">
            {s.itemCount} item{s.itemCount === 1 ? '' : 's'}
          </p>
          <p className="text-sm tabular-nums">{mrr(s)}</p>
        </div>
        <p className="text-base-content/70 text-xs">
          Next charge {nextCharge(s)} · {s.providerSlug}
        </p>
      </>
    ),
  };

  return (
    <SelectionList
      items={items}
      view={view}
      getId={(s) => s.id}
      selectable={false}
      getRowLabel={(s) => s.id}
      entityLabelPlural="subscriptions"
      columns={columns}
      card={card}
    />
  );
}
