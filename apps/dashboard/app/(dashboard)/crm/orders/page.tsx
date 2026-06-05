import { ShoppingCart, Plus } from 'lucide-react';

import {
  Badge,
  Card,
  CardContent,
  Container,
  EmptyState,
  PageHeader,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { getActivePropertyId, listProperties, type Property } from '@/lib/sites';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { EntityRowLink } from '../../_components/entity-row-link';
import { ListToolbar } from '../../_components/list-toolbar';

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  currency: string;
  total: string | number;
  amountPaid: string | number;
  placedAt: string | null;
  channel: string | null;
}

// Orders index — sortable + filterable table. Filters live in the query
// string so links and saved views serialize cleanly.

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'outline' | 'danger'> = {
  placed: 'outline',
  fulfilled: 'success',
  delivered: 'success',
  cancelled: 'danger',
  refunded: 'warning',
};

const STATUS_OPTIONS = [
  { value: 'placed', label: 'Placed' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'refunded', label: 'Refunded' },
];

// Typesense order search document (the subset this list needs). Returned by
// /v1/search/orders — typo-tolerant across order number + customer + items.
interface OrderSearchDoc {
  order_id: string;
  order_number: string;
  status: string;
  payment_status: string;
  currency: string;
  total_cents: number;
  placed_at: number; // epoch seconds
  channel?: string;
}

export default async function OrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = stringParam(params.status);
  const paymentStatus = stringParam(params.paymentStatus);
  const q = stringParam(params.q);
  // Origin-site filter (docs/58 D1) — follows the global site switcher: absent →
  // the active site; `all` → the whole tenant; an id → that site.
  const siteParam = stringParam(params.site);

  const [sites, activeCookieId] = await Promise.all([
    listProperties().catch(() => [] as Property[]),
    getActivePropertyId(),
  ]);
  const multiSite = sites.length > 1;
  const activePropertyId = multiSite
    ? (sites.find((s) => s.id === activeCookieId)?.id ??
      sites.find((s) => s.isPrimary)?.id ??
      sites[0]?.id)
    : undefined;
  const propertyFilter = !multiSite
    ? undefined
    : siteParam === 'all'
      ? undefined
      : (siteParam ?? activePropertyId);

  // With a query, search via Typesense (typo-tolerant, matches order number +
  // customer name/email + item titles); without one, list straight from
  // Postgres with the status/payment facets. `amountPaid` isn't indexed, so
  // search rows show — for Paid; the detail view has the full picture.
  let orders: OrderRow[];
  let total: number;
  if (q) {
    // Search via Typesense, scoped to the active site (docs/58 D1) via the
    // orders `property_id` facet — same selection as the browse list below.
    const sq = new URLSearchParams({ q, per_page: '100' });
    if (propertyFilter) sq.set('property', propertyFilter);
    const { data, meta } = await api.getPaged<OrderSearchDoc[]>(
      `/v1/search/orders?${sq.toString()}`
    );
    orders = data.map((d) => ({
      id: d.order_id,
      orderNumber: d.order_number,
      status: d.status,
      paymentStatus: d.payment_status,
      currency: d.currency,
      total: d.total_cents / 100,
      amountPaid: Number.NaN, // not indexed — rendered as —
      placedAt: new Date(d.placed_at * 1000).toISOString(),
      channel: d.channel ?? null,
    }));
    total = (meta?.total as number | undefined) ?? orders.length;
  } else {
    const query = new URLSearchParams({ take: '100', sort_by: 'placedAt' });
    if (status) query.set('status', status);
    if (paymentStatus) query.set('payment_status', paymentStatus);
    if (propertyFilter) query.set('property', propertyFilter);
    const res = await api.getPaged<OrderRow[]>(`/v1/crm/orders?${query.toString()}`);
    orders = res.data;
    total = (res.meta?.total as number | undefined) ?? orders.length;
  }

  // The Site filter only appears for multi-site tenants; it defaults to the
  // active site (mirroring the global switcher) with an "All sites" escape.
  const siteFilter = multiSite
    ? [
        {
          key: 'site',
          label: 'Site',
          defaultValue: activePropertyId,
          options: [
            { value: 'all', label: 'All sites' },
            ...sites.map((s) => ({ value: s.id, label: s.name })),
          ],
        },
      ]
    : [];

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<ShoppingCart className="h-5 w-5" />}
          title="Orders"
          badge={
            <Badge color="module">
              {total} order{total === 1 ? '' : 's'}
            </Badge>
          }
          description="Customer orders — placed, paid, fulfilled, delivered, refunded. Linked back to customer records and (optionally) to a sales deal via the deal_orders join."
          actions={
            <EntityCreateButton
              entityType="order"
              newHref="/crm/orders/new"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </EntityCreateButton>
          }
        />

        <ListToolbar
          searchPlaceholder="Search order #, customer, or item…"
          filters={[
            { key: 'status', label: 'Statuses', options: STATUS_OPTIONS },
            { key: 'paymentStatus', label: 'Payment', options: PAYMENT_STATUS_OPTIONS },
            ...siteFilter,
          ]}
        />

        {orders.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<ShoppingCart className="h-5 w-5" />}
              title="No orders match"
              description="Orders placed through the storefront, B2B portal, or admin appear here. Adjust filters above or place a new order manually."
            />
          </Card>
        ) : (
          <Card padding="none">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead>Placed</TableHead>
                    <TableHead>Channel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <EntityRowLink
                          href={`/crm/orders/${o.id}`}
                          entityType="order"
                          entityId={o.id}
                          className="text-sm font-medium hover:text-[var(--module-active)] hover:underline"
                        >
                          {o.orderNumber}
                        </EntityRowLink>
                      </TableCell>
                      <TableCell>
                        <Badge color={STATUS_VARIANT[o.status] ?? 'outline'} className="text-xs">
                          {o.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {o.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {o.currency} {Number(o.total).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number.isNaN(Number(o.amountPaid))
                          ? '—'
                          : `${o.currency} ${Number(o.amountPaid).toLocaleString()}`}
                      </TableCell>
                      <TableCell>
                        <Text size="sm" variant="muted">
                          {o.placedAt ? new Date(o.placedAt).toLocaleDateString() : '—'}
                        </Text>
                      </TableCell>
                      <TableCell>
                        <Text size="sm" variant="muted">
                          {o.channel ?? '—'}
                        </Text>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
