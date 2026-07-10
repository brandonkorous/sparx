import { Repeat2 } from 'lucide-react';

import { ListPageShell, PageHeader } from '@sparx/ui';
import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';

import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { parsePageParams } from '@/lib/pagination';
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

export default async function SubscriptionsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    const { skip, take } = parsePageParams(params);
    const statusParam = stringParam(params.status);
    const viewParam = stringParam(params.view);
    const status = isStatus(statusParam) ? statusParam : undefined;

    const query = new URLSearchParams({ take: String(take), skip: String(skip) });
    if (status) query.set('status', status);

    const [prefs, { data: items, meta }] = await Promise.all([
        getUserPreferences(),
        api.getPaged<SubscriptionSummary[]>(`/v1/commerce/subscriptions?${query.toString()}`),
    ]);
    const total = (meta?.total as number | undefined) ?? items.length;

    const mrrCents = items.reduce((sum, s) => sum + s.monthlyRecurringRevenueCents, 0);
    const view = (viewParam ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

    return (
        <ListPageShell
            header={
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
                    className="mb-0"
                />
            }
            toolbar={
                <ListToolbar
                    searchable={false}
                    filters={[{ key: 'status', label: 'Statuses', options: STATUS_OPTIONS }]}
                    enableViewToggle
                />
            }
            pager={<ListPager total={total} />}
        >
            {items.length === 0 ? (
                <Card className="bg-base-100">
                    <EmptyState
                        icon={<Repeat2 className="h-5 w-5" />}
                        title="No subscriptions"
                        description="Subscriptions are created from the storefront after a customer signs up for auto-ship; nothing for staff to do here yet."
                    />
                </Card>
            ) : (
                <>
                    <p className="text-base-content/70 text-sm">
                        {status ? labelForStatus(status) : 'All subscriptions'} — MRR is normalized to a monthly
                        cadence; annual / weekly / daily subs are converted.
                    </p>
                    <SubscriptionsList items={items} view={view} />
                </>
            )}
        </ListPageShell>
    );
}

function stringParam(v: string | string[] | undefined): string | undefined {
    if (Array.isArray(v)) return v[0];
    if (typeof v === 'string' && v.length > 0) return v;
    return undefined;
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
