'use client';

import {
  Badge,
  type SelectionCard,
  type SelectionColumn,
  SelectionList,
  Stack,
  statusLabel,
  statusTone,
  Text,
} from '@sparx/ui';

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
      cell: (s) => (
        <Text size="xs" className="font-mono">
          {s.customerId.slice(0, 8)}
        </Text>
      ),
    },
    { header: 'Items', cell: (s) => s.itemCount },
    { header: 'Status', cell: (s) => <StatusBadge status={s.status} /> },
    { header: 'Next charge', cell: (s) => nextCharge(s) },
    { header: 'MRR', cell: (s) => mrr(s) },
    {
      header: 'Provider',
      cell: (s) => (
        <Text size="xs" className="font-mono">
          {s.providerSlug}
        </Text>
      ),
    },
  ];

  const card: SelectionCard<SubscriptionSummary> = {
    title: (s) => idLink(s, 'truncate font-mono text-sm hover:text-[var(--module-active)]'),
    subtitle: (s) => (
      <Text size="xs" variant="muted" className="font-mono">
        {s.customerId.slice(0, 8)}
      </Text>
    ),
    badge: (s) => <StatusBadge status={s.status} />,
    body: (s) => (
      <>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text size="sm" variant="muted">
            {s.itemCount} item{s.itemCount === 1 ? '' : 's'}
          </Text>
          <Text size="sm" className="tabular-nums">
            {mrr(s)}
          </Text>
        </Stack>
        <Text size="xs" variant="muted">
          Next charge {nextCharge(s)} · {s.providerSlug}
        </Text>
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
