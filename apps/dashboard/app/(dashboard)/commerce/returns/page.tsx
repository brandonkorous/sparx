import { Inbox } from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Container,
  EmptyState,
  Heading,
  PageHeader,
  Stack,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';

import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import { ReturnsList, type ReturnStatus, type ReturnSummary } from './_components/returns-list';

export const dynamic = 'force-dynamic';

const STATUS_OPTIONS = [
  { value: 'requested', label: 'New' },
  { value: 'approved', label: 'Approved' },
  { value: 'awaiting_shipment', label: 'Awaiting shipment' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'received', label: 'Received' },
  { value: 'inspecting', label: 'Inspecting' },
  { value: 'inspected', label: 'Inspected' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'denied', label: 'Denied' },
];

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const statusParam = stringParam(params.status);
  const viewParam = stringParam(params.view);
  const status = isStatus(statusParam) ? statusParam : undefined;
  const { skip, take } = parsePageParams(params);

  const query = new URLSearchParams();
  if (status) query.set('status', status);
  query.set('take', String(take));
  query.set('skip', String(skip));
  const [prefs, { data: items, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<ReturnSummary[]>(`/v1/commerce/returns?${query.toString()}`),
  ]);
  const total = (meta?.total as number | undefined) ?? items.length;

  const view = (viewParam ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Inbox className="h-5 w-5" />}
          title="Returns"
          badge={<Badge color="module">{total} total</Badge>}
          description="Customer- or staff-initiated returns. Approve, generate a label, receive, inspect each line, then settle as refund or account credit. Provider-driven refund settlement (Stripe, etc.) happens via the order-payments path once a TaxProvider/PaymentProvider is wired into the marketplace."
        />

        <ListToolbar
          searchable={false}
          filters={[{ key: 'status', label: 'Statuses', options: STATUS_OPTIONS }]}
          enableViewToggle
        />

        {items.length === 0 ? (
          <Card>
            <CardHeader>
              <Stack gap={1}>
                <Heading level={3}>{status ? labelForStatus(status) : 'All returns'}</Heading>
                <CardDescription>Click an ID to open the inspection queue.</CardDescription>
              </Stack>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={<Inbox className="h-5 w-5" />}
                title="No returns"
                description={
                  status === 'requested'
                    ? 'No new return requests waiting for staff review.'
                    : 'Returns are created when customers submit one from /account/orders.'
                }
              />
            </CardContent>
          </Card>
        ) : (
          <Stack gap={1}>
            <Heading level={3}>{status ? labelForStatus(status) : 'All returns'}</Heading>
            <CardDescription>Click an ID to open the inspection queue.</CardDescription>
            <ReturnsList rows={items} view={view} />
          </Stack>
        )}

        <ListPager total={total} />
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

function labelForStatus(s: ReturnStatus): string {
  return s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function isStatus(value: string | undefined): value is ReturnStatus {
  if (!value) return false;
  return (
    value === 'requested' ||
    value === 'approved' ||
    value === 'denied' ||
    value === 'awaiting_shipment' ||
    value === 'in_transit' ||
    value === 'received' ||
    value === 'inspecting' ||
    value === 'inspected' ||
    value === 'refunded' ||
    value === 'cancelled'
  );
}
