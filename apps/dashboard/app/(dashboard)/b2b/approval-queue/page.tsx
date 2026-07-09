import { CheckCircle } from 'lucide-react';

import { PageHeader } from '@sparx/ui';
import { Badge, Card, CardBody, EmptyState } from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';
import { getUserPreferences } from '../../_shell/preferences';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { parsePageParams } from '@/lib/pagination';
import { ApprovalQueueList } from './_components/approval-queue-list';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface QueuedOrder {
  id: string;
  orderNumber: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  customerId: string;
  customerName: string | null;
  customerEmail: string;
  b2bAccountId: string | null;
  companyName: string | null;
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

export default async function ApprovalQueuePage({ searchParams }: PageProps) {
  const params = await searchParams;
  // account_id stays URL-readable for deep links from an account page; it isn't
  // a toolbar control. The queue has no text search or status facet on its
  // endpoint, so the toolbar surfaces only the view toggle.
  const accountId = stringParam(params.account_id);
  const { skip, take } = parsePageParams(params);

  const query = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (accountId) query.set('account_id', accountId);

  const [prefs, { data: orders, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<QueuedOrder[]>(`/v1/b2b/approval-queue?${query.toString()}`),
  ]);
  const total = (meta?.total as number | undefined) ?? orders.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<CheckCircle className="h-5 w-5" />}
          title="Approval Queue"
          badge={
            total > 0 ? (
              <Badge color="warning" variant="soft">
                {total} pending
              </Badge>
            ) : (
              <Badge color="success" variant="soft">
                All clear
              </Badge>
            )
          }
          description="B2B portal orders waiting for staff review before they are placed."
        />

        <ListToolbar enableViewToggle searchable={false} />

        {orders.length === 0 ? (
          <Card>
            <CardBody className="p-0">
              <EmptyState
                icon={<CheckCircle className="h-5 w-5" />}
                title="No orders pending approval"
                description="B2B portal orders that exceed an approval threshold will appear here."
              />
            </CardBody>
          </Card>
        ) : (
          <ApprovalQueueList orders={orders} view={view} />
        )}

        <ListPager total={total} />
      </div>
    </div>
  );
}
