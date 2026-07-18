import { Plus } from 'lucide-react';

import { ListPageShell, PageHeader } from '@sparx/ui';
import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';

import { resolveSiteScope } from '@/lib/sites';
import { parsePageParams } from '@/lib/pagination';

import { EntityCreateButton } from '../_components/entity-create-button';
import { ListToolbar } from '../_components/list-toolbar';
import { ListPager } from '../_components/list-pager';
import { getUserPreferences } from '../_shell/preferences';
import { OrdersSelectionTable } from './components/orders-selection-table';
import { loadAccountOptions, loadOrders } from './order-list-data';
import type { OrderLens } from './lens';

// The shared order list. All three order routes (/commerce/orders,
// /b2b/orders, /crm/orders) render THIS with a different lens — see ./lens.ts
// for why there are three routes over one API root.
//
// Everything module-specific arrives through the lens: scope, columns, filters,
// copy, and route prefix. Nothing in this file branches on module name, so a
// fourth lens needs no edit here.

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

interface OrderListPageProps {
  lens: OrderLens;
  searchParams: Record<string, string | string[] | undefined>;
}

export async function OrderListPage({ lens, searchParams: params }: OrderListPageProps) {
  const pageParams = parsePageParams(params);
  const filters = {
    status: stringParam(params.status),
    paymentStatus: stringParam(params.paymentStatus),
    channel: stringParam(params.channel),
    account: stringParam(params.account),
    q: stringParam(params.q),
    // Origin-site filter (docs/58 D1) — follows the global site switcher: absent
    // → the active site; `all` → the whole tenant; an id → that site.
    site: stringParam(params.site),
  };

  const wantsAccountFilter = lens.filters.includes('account');
  const [prefs, scope, accountOptions] = await Promise.all([
    getUserPreferences(),
    resolveSiteScope(),
    wantsAccountFilter ? loadAccountOptions() : Promise.resolve([]),
  ]);

  const { orders, total } = await loadOrders(lens, filters, scope, pageParams);

  // `?view=` overrides; absent → the user's saved default (§7.2).
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  const Icon = lens.icon;

  return (
    <ListPageShell
      header={
        <PageHeader
          className="mb-0"
          icon={<Icon className="h-5 w-5" />}
          title={lens.title}
          badge={
            <Badge color="module">
              {total} order{total === 1 ? '' : 's'}
            </Badge>
          }
          description={lens.description}
        />
      }
      toolbar={
        <ListToolbar
          searchPlaceholder="Search order #, customer, or item…"
          filters={buildFilters(lens, scope, accountOptions)}
          enableViewToggle
          primaryAction={
            lens.canCreate ? (
              <EntityCreateButton
                entityType="order"
                newHref={`${lens.basePath}/new`}
                color="module"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                New
              </EntityCreateButton>
            ) : undefined
          }
        />
      }
      pager={<ListPager total={total} />}
    >
      {orders.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon className="h-5 w-5" />}
            title={lens.emptyTitle}
            description={lens.emptyDescription}
          />
        </Card>
      ) : (
        <OrdersSelectionTable
          orders={orders}
          view={view}
          basePath={lens.basePath}
          columns={lens.columns}
        />
      )}
    </ListPageShell>
  );
}

/** Toolbar filters for a lens, in the lens's own order. The Site filter is
 *  appended for multi-site tenants only, mirroring the global switcher with an
 *  "All sites" escape. */
function buildFilters(
  lens: OrderLens,
  scope: Awaited<ReturnType<typeof resolveSiteScope>>,
  accountOptions: { value: string; label: string }[]
) {
  const byKey = {
    status: { key: 'status', label: 'Statuses', options: STATUS_OPTIONS },
    paymentStatus: { key: 'paymentStatus', label: 'Payment', options: PAYMENT_STATUS_OPTIONS },
    channel: { key: 'channel', label: 'Channel', options: CHANNEL_OPTIONS },
    account: { key: 'account', label: 'Account', options: accountOptions },
  };

  const filters = lens.filters
    .map((key) => byKey[key])
    // An Account filter with no accounts yet is dead chrome — drop it.
    .filter((f) => f.options.length > 0);

  if (!scope.multiSite) return filters;

  return [
    ...filters,
    {
      key: 'site',
      label: 'Site',
      defaultValue: scope.activePropertyId,
      options: [
        { value: 'all', label: 'All sites' },
        ...scope.sites.map((s) => ({ value: s.id, label: s.name })),
      ],
    },
  ];
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
