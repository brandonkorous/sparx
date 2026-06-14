import { Repeat2 } from 'lucide-react';

import { Badge, Card, Container, EmptyState, PageHeader, Stack, Text } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { ListToolbar } from '../../_components/list-toolbar';
import { getUserPreferences } from '../../_shell/preferences';
import { SubscriptionsList, type SubscriptionSummary } from './_components/subscriptions-list';

export const dynamic = 'force-dynamic';

type SubscriptionStatus = 'active' | 'trialing' | 'paused' | 'past_due' | 'cancelled';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'paused', label: 'Paused' },
  { value: 'past_due', label: 'Past due' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface SubscriptionsListResponse {
  items: SubscriptionSummary[];
  total: number;
}

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string }>;
}) {
  const { status: statusParam, view: viewParam } = await searchParams;
  const status = isStatus(statusParam) ? statusParam : undefined;

  const query = new URLSearchParams();
  if (status) query.set('status', status);
  query.set('take', '100');

  const [prefs, { items, total }] = await Promise.all([
    getUserPreferences(),
    api.get<SubscriptionsListResponse>(`/v1/commerce/subscriptions?${query.toString()}`),
  ]);

  const mrrCents = items.reduce((sum, s) => sum + s.monthlyRecurringRevenueCents, 0);
  const view = (viewParam ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Repeat2 className="h-5 w-5" />}
          title="Subscriptions"
          badge={
            <Badge color="module">
              {total} total · ${(mrrCents / 100).toFixed(2)} MRR
            </Badge>
          }
          description={
            <>
              Auto-ship orders driven by the subscription-billing worker. Renewal Orders land in CRM
              → Orders with source=<code>subscription_renewal</code> so the rest of the fulfillment
              pipeline treats them identically to one-off purchases. Pause / skip / cancel actions
              live on the detail page.
            </>
          }
        />

        <ListToolbar
          searchable={false}
          filters={[{ key: 'status', label: 'Statuses', options: STATUS_OPTIONS }]}
          enableViewToggle
        />

        {items.length === 0 ? (
          <Card variant="module" padding="none">
            <EmptyState
              icon={<Repeat2 className="h-5 w-5" />}
              title="No subscriptions"
              description="Subscriptions are created from the storefront after a customer signs up for auto-ship; nothing for staff to do here yet."
            />
          </Card>
        ) : (
          <>
            <Text size="sm" variant="muted">
              {status ? labelForStatus(status) : 'All subscriptions'} — MRR is normalized to a
              monthly cadence; annual / weekly / daily subs are converted.
            </Text>
            <SubscriptionsList items={items} view={view} />
          </>
        )}
      </Stack>
    </Container>
  );
}

function labelForStatus(s: SubscriptionStatus): string {
  return s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function isStatus(value: string | undefined): value is SubscriptionStatus {
  return (
    value === 'active' ||
    value === 'trialing' ||
    value === 'paused' ||
    value === 'past_due' ||
    value === 'cancelled'
  );
}
