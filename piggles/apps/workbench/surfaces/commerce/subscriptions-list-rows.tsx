'use client';

// The repeat orders table: one row per standing order, opened with the same click
// and keyboard contract as every other list in the console.

import { Badge } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { formatCents, formatDate, subscriptionState } from './products-data';
import type { SubscriptionSummary } from './subscriptions-data';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

function SubscriptionRow({
  sub,
  onOpen,
}: {
  sub: SubscriptionSummary;
  onOpen: (sub: SubscriptionSummary, event: OpenEvent) => void;
}) {
  const state = subscriptionState(sub.status);
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onOpen(sub, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(sub, event);
      }}
    >
      <td className="max-w-48 truncate font-medium">{sub.customerName ?? 'A customer'}</td>
      <td>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge color={state.tone} variant="soft" size="sm">
            {state.label}
          </Badge>
          {/* An invoiced repeat order only ships once someone pays a bill, so it
              earns its own mark rather than looking like one that charges itself. */}
          {sub.billingMode === 'invoice' ? (
            <Badge color="info" variant="soft" size="sm">
              Invoiced
            </Badge>
          ) : null}
        </div>
      </td>
      <td data-label="Next delivery" className="hidden text-sm @lg:table-cell">
        {sub.nextOccurrenceAt ? formatDate(sub.nextOccurrenceAt) : '—'}
      </td>
      <td className="hidden text-sm @xl:table-cell">
        {sub.itemCount === 1 ? '1 product' : `${String(sub.itemCount)} products`}
      </td>
      <td data-label="Per month" className="text-right font-medium tabular-nums">
        {formatCents(sub.monthlyRecurringRevenueCents, sub.currency)}
      </td>
    </tr>
  );
}

export function SubscriptionsTable({
  rows,
  onOpen,
}: {
  rows: SubscriptionSummary[];
  onOpen: (sub: SubscriptionSummary, event: OpenEvent) => void;
}) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Customer</th>
          <th>Status</th>
          <th className="hidden @lg:table-cell">Next delivery</th>
          <th className="hidden @xl:table-cell">Items</th>
          <th className="text-right">Per month</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((sub) => (
          <SubscriptionRow key={sub.id} sub={sub} onOpen={onOpen} />
        ))}
      </tbody>
    </Table>
  );
}
