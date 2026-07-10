import { ShoppingCart, Plus } from 'lucide-react';

import { ListPageShell, PageHeader } from '@sparx/ui';
import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';
import { resolveSiteScope, resolvePropertyFilter } from '@/lib/sites';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { OrdersSelectionTable } from './_components/orders-selection-table';
import type { OrderRow } from './_components/orders-selection-table';

// Orders index — sortable + filterable table. Filters live in the query
// string so links and saved views serialize cleanly.

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

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

// High-level origin bucket (docs/106 §4.4) — 'marketplace' surfaces every external
// sales-channel order (TikTok Shop, …); the row badge names the specific channel.
const CHANNEL_OPTIONS = [
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'storefront', label: 'Storefront' },
  { value: 'b2b_portal', label: 'B2B portal' },
  { value: 'admin', label: 'Admin' },
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
  const { page, perPage, skip, take } = parsePageParams(params);
  const status = stringParam(params.status);
  const paymentStatus = stringParam(params.paymentStatus);
  const channel = stringParam(params.channel);
  const q = stringParam(params.q);
  // Origin-site filter (docs/58 D1) — follows the global site switcher: absent →
  // the active site; `all` → the whole tenant; an id → that site.
  const siteParam = stringParam(params.site);

  const [prefs, scope] = await Promise.all([getUserPreferences(), resolveSiteScope()]);
  const { sites, multiSite, activePropertyId } = scope;
  const propertyFilter = resolvePropertyFilter(scope, siteParam);

  // With a query, search via Typesense (typo-tolerant, matches order number +
  // customer name/email + item titles); without one, list straight from
  // Postgres with the status/payment facets. `amountPaid` isn't indexed, so
  // search rows show — for Paid; the detail view has the full picture.
  let orders: OrderRow[];
  let total: number;
  if (q) {
    // Search via Typesense, scoped to the active site (docs/58 D1) via the
    // orders `property_id` facet — same selection as the browse list below.
    const sq = new URLSearchParams({ q, page: String(page), per_page: String(perPage) });
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
      // The marketplace source isn't indexed in Typesense — the browse list below
      // carries it; search rows badge by channel only.
      source: null,
    }));
    total = (meta?.total as number | undefined) ?? orders.length;
  } else {
    const query = new URLSearchParams({
      take: String(take),
      skip: String(skip),
      sort_by: 'placedAt',
    });
    if (status) query.set('status', status);
    if (paymentStatus) query.set('payment_status', paymentStatus);
    if (channel) query.set('channel', channel);
    if (propertyFilter) query.set('property', propertyFilter);
    const res = await api.getPaged<OrderRow[]>(`/v1/crm/orders?${query.toString()}`);
    orders = res.data;
    total = (res.meta?.total as number | undefined) ?? orders.length;
  }

  // `?view=` overrides; absent → the user's saved default (§7.2).
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

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
    <ListPageShell
      header={
        <PageHeader
          className="mb-0"
          icon={<ShoppingCart className="h-5 w-5" />}
          title="Orders"
          badge={
            <Badge color="module">
              {total} order{total === 1 ? '' : 's'}
            </Badge>
          }
          description="Customer orders — placed, paid, fulfilled, delivered, refunded. Linked back to customer records and (optionally) to a sales deal via the deal_orders join."
        />
      }
      toolbar={
        <ListToolbar
          searchPlaceholder="Search order #, customer, or item…"
          filters={[
            { key: 'status', label: 'Statuses', options: STATUS_OPTIONS },
            { key: 'paymentStatus', label: 'Payment', options: PAYMENT_STATUS_OPTIONS },
            { key: 'channel', label: 'Channel', options: CHANNEL_OPTIONS },
            ...siteFilter,
          ]}
          enableViewToggle
          primaryAction={
            <EntityCreateButton
              entityType="order"
              newHref="/crm/orders/new"
              color="module"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </EntityCreateButton>
          }
        />
      }
      pager={<ListPager total={total} />}
    >
      {orders.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShoppingCart className="h-5 w-5" />}
            title="No orders match"
            description="Orders placed through your storefront, B2B portal, admin, or a connected sales channel (TikTok Shop, …) appear here. Adjust filters above or place a new order manually."
          />
        </Card>
      ) : (
        <OrdersSelectionTable orders={orders} view={view} />
      )}
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
