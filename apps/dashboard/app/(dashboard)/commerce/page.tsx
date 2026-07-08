import Link from 'next/link';
import {
  Box,
  CreditCard,
  DollarSign,
  Download,
  Package,
  Percent,
  Plus,
  ShoppingCart,
  Tag,
  TrendingUp,
  Users,
} from 'lucide-react';

import { requireSession } from '@sparx/auth';
import { AreaChart, ModuleProvider, PageHeader, Stat } from '@sparx/ui';
import { Badge, Button, EmptyState } from 'silicaui-react';

import { api } from '@/lib/api-rest-client';
import { EntityCreateButton } from '../_components/entity-create-button';
import {
  CardLink,
  MetricTile,
  OverviewCard,
  OverviewRow,
  fmtMoneyCents,
  fmtNumber,
  fmtPercentRatio,
} from '../_components/overview-bits';

// Commerce overview — the storekeeper's morning glance: revenue pulse, cashflow,
// and what's selling. Every section is wired to the live
// /v1/commerce/reports/* endpoints; a section with no data yet renders a compact
// empty state rather than illustrative sample data.

export const dynamic = 'force-dynamic';

const TWO_COL = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.9fr_1fr]';
const TWO_COL_WIDE = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]';

interface RevenueSummary {
  netRevenueCents: number;
  averageOrderValueCents: number;
  ordersCount: number;
  currency: string;
}
interface ConversionFunnel {
  sessions: number;
  ordersPlaced: number;
  overallConversion: number;
}
interface SubscriptionMetrics {
  mrrCents: number;
  currency: string;
  activeCount: number;
  newThisPeriod: number;
  churnedThisPeriod: number;
}
interface AbandonedCarts {
  abandonedCount: number;
  recoveredCount: number;
  recoveryRate: number;
}
interface TopProductRow {
  productId: string;
  productTitle: string;
  unitsSold: number;
  revenueCents: number;
}
interface TopCustomerRow {
  customerId: string;
  customerName: string;
  ordersCount: number;
  totalSpentCents: number;
}
interface InventoryValuation {
  totalUnits: number;
  totalCostCents: number;
  totalRetailCents: number;
  currency: string;
  asOf: string;
}
interface RevenueTimeseriesPoint {
  bucket: string;
  ordersCount: number;
  grossCents: number;
  discountCents: number;
  refundedCents: number;
  netCents: number;
}
interface RevenueTimeseries {
  range: { from: string; to: string; grain: string };
  points: RevenueTimeseriesPoint[];
  totals: {
    ordersCount: number;
    grossCents: number;
    discountCents: number;
    refundedCents: number;
    netCents: number;
  };
  currency: string;
}

// Display rows for the live top-products / top-customers lists.
interface TopProductDisplay {
  name: string;
  meta?: string;
  revenueCents: number;
  units: number;
  unitsSuffix: string;
  swatch: string;
}
interface TopCustomerDisplay {
  name: string;
  orders: number;
  spentCents: number;
}

const PRODUCT_SWATCHES = [
  'linear-gradient(135deg,#7c2d12,#b45309)',
  'linear-gradient(135deg,#92400e,#d97706)',
  'linear-gradient(135deg,#3f2d1c,#78350f)',
  'linear-gradient(135deg,#1c1917,#44403c)',
  'linear-gradient(135deg,#a16207,#ca8a04)',
] as const;

interface DiscountPerfRow {
  discountId: string;
  code: string | null;
  name: string;
  type: string;
  status: string;
  redemptions: number;
  discountCents: number;
  uniqueOrders: number;
}
interface DiscountPerformance {
  rangeLabel: string;
  totalRedemptions: number;
  totalDiscountCents: number;
  activeDiscounts: number;
  byDiscount: DiscountPerfRow[];
  currency: string;
}
// Consolidated channel revenue (docs/27 §8): marketplace orders split by source
// (TikTok Shop, Etsy, …) instead of collapsing into one "marketplace" line, with
// the human `label` precomputed by the service. Only the fields this card reads.
interface ChannelRevenueRow {
  channel: string;
  label: string;
  orders: number;
  grossRevenueCents: number;
  sharePct: number;
}
interface ChannelRevenueReport {
  rangeLabel: string;
  totalOrders: number;
  totalGrossRevenueCents: number;
  byChannel: ChannelRevenueRow[];
  currency: string;
}

export default async function CommercePage() {
  await requireSession();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const range = `from=${encodeURIComponent(thirtyDaysAgo.toISOString())}&to=${encodeURIComponent(now.toISOString())}`;
  const range14 = `from=${encodeURIComponent(fourteenDaysAgo.toISOString())}&to=${encodeURIComponent(now.toISOString())}`;

  const [
    revenue,
    funnel,
    subs,
    abandoned,
    liveProducts,
    liveCustomers,
    valuation,
    revenueTs,
    discountPerf,
    channels,
  ] = await Promise.all([
    api.get<RevenueSummary>(`/v1/commerce/reports/revenue-summary?${range}`).catch(() => null),
    api.get<ConversionFunnel>(`/v1/commerce/reports/conversion-funnel?${range}`).catch(() => null),
    api.get<SubscriptionMetrics>('/v1/commerce/reports/subscription-metrics').catch(() => null),
    api.get<AbandonedCarts>(`/v1/commerce/reports/abandoned-carts?${range}`).catch(() => null),
    api
      .get<TopProductRow[]>(`/v1/commerce/reports/top-products?${range}&limit=5`)
      .catch(() => null),
    api
      .get<TopCustomerRow[]>(`/v1/commerce/reports/top-customers?${range}&limit=5`)
      .catch(() => null),
    api.get<InventoryValuation>('/v1/commerce/reports/inventory-valuation').catch(() => null),
    api
      .get<RevenueTimeseries>(`/v1/commerce/reports/revenue-timeseries?${range14}&grain=day`)
      .catch(() => null),
    api
      .get<DiscountPerformance>('/v1/commerce/reports/discount-performance?limit=4')
      .catch(() => null),
    api
      .get<ChannelRevenueReport>(`/v1/commerce/reports/channel-revenue?${range}`)
      .catch(() => null),
  ]);
  const currency = revenue?.currency ?? 'USD';

  // Top products + top customers — live once the store has sales, else a compact
  // empty state.
  const topProducts: TopProductDisplay[] =
    liveProducts?.map((p, i) => ({
      name: p.productTitle,
      revenueCents: p.revenueCents,
      units: p.unitsSold,
      unitsSuffix: 'sold',
      swatch: PRODUCT_SWATCHES[i % PRODUCT_SWATCHES.length] ?? PRODUCT_SWATCHES[0],
    })) ?? [];
  const topCustomers: TopCustomerDisplay[] =
    liveCustomers?.map((c) => ({
      name: c.customerName,
      orders: c.ordersCount,
      spentCents: c.totalSpentCents,
    })) ?? [];

  // Revenue chart + footer: live the moment the tenant has any orders in the
  // window, else a compact empty state. The endpoint returns a continuous
  // zero-filled daily series, so we gate on totals.ordersCount.
  const revenuePoints =
    revenueTs && revenueTs.totals.ordersCount > 0
      ? revenueTs.points.map((p) => ({
          label: new Date(`${p.bucket}T00:00:00Z`).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          }),
          revenue: p.netCents / 100,
        }))
      : null;
  const neg = (cents: number) =>
    cents > 0 ? `−${fmtMoneyCents(cents, currency)}` : fmtMoneyCents(cents, currency);
  const revenueFooter: [string, string][] =
    revenuePoints && revenueTs
      ? [
          ['Gross', fmtMoneyCents(revenueTs.totals.grossCents, currency)],
          ['Refunds', neg(revenueTs.totals.refundedCents)],
          ['Discounts', neg(revenueTs.totals.discountCents)],
          ['Net', fmtMoneyCents(revenueTs.totals.netCents, currency)],
        ]
      : [];

  const hasInventory = valuation != null && valuation.totalUnits > 0;

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-8">
        <PageHeader
          icon={<ShoppingCart className="h-5 w-5" />}
          title="Commerce"
          description="How your store is doing — last 30 days."
          actions={
            <>
              <Button
                variant="outline"
                iconStart={<Download className="h-4 w-4" />}
                render={<Link href="/commerce/reports" />}
              >
                Export
              </Button>
              <Button
                variant="outline"
                iconStart={<Tag className="h-4 w-4" />}
                render={<Link href="/commerce/discounts/new" />}
              >
                New discount
              </Button>
              <EntityCreateButton
                entityType="product"
                newHref="/commerce/products/new"
                color="module"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Add product
              </EntityCreateButton>
            </>
          }
        />

        {/* Headline KPIs — live */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={<DollarSign className="h-4 w-4" />}
            label="Revenue · 30d"
            value={fmtMoneyCents(revenue?.netRevenueCents, currency)}
            hint={
              revenue
                ? `${fmtNumber(revenue.ordersCount)} orders · AOV ${fmtMoneyCents(revenue.averageOrderValueCents, currency)}`
                : 'Awaiting your first order'
            }
          />
          <Stat
            icon={<ShoppingCart className="h-4 w-4" />}
            label="Orders · 30d"
            value={fmtNumber(revenue?.ordersCount)}
            hint="Paid orders, last 30 days"
          />
          <Stat
            icon={<Package className="h-4 w-4" />}
            label="Avg. order value"
            value={fmtMoneyCents(revenue?.averageOrderValueCents, currency)}
            hint="Across paid orders"
          />
          <Stat
            icon={<Percent className="h-4 w-4" />}
            label="Conversion"
            value={funnel ? fmtPercentRatio(funnel.overallConversion, 2) : '—'}
            hint={
              funnel
                ? `${fmtNumber(funnel.sessions)} sessions → ${fmtNumber(funnel.ordersPlaced)} orders`
                : 'Sessions not yet tracked'
            }
          />
        </div>

        {/* Revenue + payouts */}
        <div className={TWO_COL}>
          <OverviewCard
            title="Revenue"
            icon={<TrendingUp className="h-4 w-4" />}
            description="Net sales, last 14 days"
          >
            {revenuePoints ? (
              <>
                <AreaChart
                  data={revenuePoints}
                  series={[{ key: 'revenue', label: 'Revenue', color: 'module' }]}
                  xKey="label"
                  height={210}
                  valueFormat={{ kind: 'currency', currency }}
                  ariaLabel="Net revenue, last 14 days"
                />
                <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--color-border-default)] pt-3 text-sm">
                  {revenueFooter.map(([label, value]) => (
                    <div key={label}>
                      <div className="text-xs text-[var(--color-text-tertiary)]">{label}</div>
                      <div className="font-medium">{value}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                icon={<TrendingUp className="h-5 w-5" />}
                title="No revenue yet"
                description="Net sales appear here once your first orders come in."
              />
            )}
          </OverviewCard>

          {/* Payouts is a FINANCE signal on the Commerce page — wrap it in the
              Finance provider so it wears the Finance (green) hue and pops as the
              one finance-colored card amid the commerce-tinted overview. */}
          <ModuleProvider module="finance" className="contents">
            <OverviewCard title="Payouts" icon={<CreditCard className="h-4 w-4" />}>
              <EmptyState
                icon={<CreditCard className="h-5 w-5" />}
                title="No payouts yet"
                description="Your balance and next payout show here once you start taking payments."
                actions={
                  <Button variant="outline" size="sm" render={<Link href="/finance/payments" />}>
                    Set up payments
                  </Button>
                }
              />
            </OverviewCard>
          </ModuleProvider>
        </div>

        {/* Recent orders + top products */}
        <div className={TWO_COL_WIDE}>
          <OverviewCard
            title="Recent orders"
            icon={<ShoppingCart className="h-4 w-4" />}
            right={<CardLink href="/commerce/orders">All orders</CardLink>}
            plain
          >
            <EmptyState
              icon={<ShoppingCart className="h-5 w-5" />}
              title="No orders yet"
              description="New orders will appear here as customers check out."
            />
          </OverviewCard>

          <OverviewCard
            title="Top products"
            icon={<TrendingUp className="h-4 w-4" />}
            right={<CardLink href="/commerce/reports">Report</CardLink>}
            plain
          >
            {topProducts.length ? (
              <div className="flex flex-col">
                {topProducts.map((p, i) => (
                  <div
                    key={`${p.name}-${i}`}
                    className="flex items-center gap-3 border-b border-[var(--color-border-default)] py-2.5 last:border-b-0"
                  >
                    <span
                      aria-hidden
                      className="h-9 w-9 shrink-0 rounded-md"
                      style={{ background: p.swatch }}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      {p.meta && (
                        <div className="text-xs text-[var(--color-text-tertiary)]">{p.meta}</div>
                      )}
                    </div>
                    <div className="ml-auto text-right">
                      <div className="text-sm font-medium tabular-nums">
                        {fmtMoneyCents(p.revenueCents, currency)}
                      </div>
                      <div className="text-xs text-[var(--color-text-tertiary)]">
                        {fmtNumber(p.units)} {p.unitsSuffix}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<TrendingUp className="h-5 w-5" />}
                title="No sales yet"
                description="Your best-selling products will rank here."
              />
            )}
          </OverviewCard>
        </div>

        {/* Customers + inventory + recover & grow */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* CRM is this page's secondary module — Top customers is its primary
              card, so it wears the CRM (cyan) tint via a nested provider. */}
          <ModuleProvider module="crm" className="contents">
            <OverviewCard
              title="Top customers"
              icon={<Users className="h-4 w-4" />}
              right={<CardLink href="/crm/customers">CRM</CardLink>}
            >
              {topCustomers.length ? (
                topCustomers.map((c, i) => (
                  <OverviewRow
                    key={`${c.name}-${i}`}
                    icon={<Users className="h-4 w-4" />}
                    tone="module"
                    title={c.name}
                    hint={`${fmtNumber(c.orders)} orders`}
                    right={fmtMoneyCents(c.spentCents, currency)}
                  />
                ))
              ) : (
                <EmptyState
                  icon={<Users className="h-5 w-5" />}
                  title="No customers yet"
                  description="Your highest-value customers will rank here."
                />
              )}
            </OverviewCard>
          </ModuleProvider>

          {/* Inventory is the page's third module — its primary card wears the
              Inventory (amber) tint. Status rows stay semantic (danger/warning). */}
          <ModuleProvider module="inventory" className="contents">
            <OverviewCard
              title="Inventory"
              icon={<Box className="h-4 w-4" />}
              right={<CardLink href="/inventory/stock">Manage</CardLink>}
            >
              {hasInventory ? (
                <div className="grid grid-cols-2 gap-3 text-center">
                  <MetricTile value={fmtNumber(valuation?.totalUnits)} label="Units in stock" />
                  <MetricTile
                    value={fmtMoneyCents(
                      valuation?.totalRetailCents,
                      valuation?.currency ?? currency
                    )}
                    label="Stock value"
                  />
                </div>
              ) : (
                <EmptyState
                  icon={<Box className="h-5 w-5" />}
                  title="No stock tracked yet"
                  description="Add products with inventory to see your stock valuation."
                  actions={
                    <Button variant="outline" size="sm" render={<Link href="/inventory/stock" />}>
                      Manage stock
                    </Button>
                  }
                />
              )}
            </OverviewCard>
          </ModuleProvider>

          <OverviewCard title="Recover & grow" icon={<ShoppingCart className="h-4 w-4" />} plain>
            <OverviewRow
              icon={<ShoppingCart className="h-4 w-4" />}
              tone="module"
              title="Abandoned carts"
              hint={
                abandoned
                  ? `${fmtNumber(abandoned.recoveredCount)} of ${fmtNumber(abandoned.abandonedCount)} recovered`
                  : 'Recovery automation not running yet'
              }
              right={abandoned ? fmtPercentRatio(abandoned.recoveryRate, 1) : '—'}
            />
            <OverviewRow
              icon={<TrendingUp className="h-4 w-4" />}
              tone="success"
              title="Subscriptions MRR"
              hint={
                subs
                  ? `${fmtNumber(subs.activeCount)} active · +${fmtNumber(subs.newThisPeriod)} new`
                  : 'Activate auto-ship to grow MRR'
              }
              right={fmtMoneyCents(subs?.mrrCents, subs?.currency ?? currency)}
            />
            {discountPerf && discountPerf.byDiscount.length > 0 ? (
              discountPerf.byDiscount.slice(0, 2).map((d) => (
                <OverviewRow
                  key={d.discountId}
                  icon={<Tag className="h-4 w-4" />}
                  tone="module"
                  title={d.code ?? d.name}
                  hint={`${fmtMoneyCents(d.discountCents, currency)} given · ${fmtNumber(d.redemptions)} use${d.redemptions === 1 ? '' : 's'}`}
                  right={
                    <Badge color={d.status === 'active' ? 'success' : 'neutral'} variant="soft">
                      {d.status === 'active' ? 'Active' : d.status}
                    </Badge>
                  }
                />
              ))
            ) : (
              <OverviewRow
                icon={<Tag className="h-4 w-4" />}
                tone="module"
                title="No discounts yet"
                hint="Create a discount to drive repeat purchases"
                right={
                  <Button
                    variant="link"
                    color="module"
                    size="sm"
                    render={<Link href="/commerce/discounts/new" />}
                  >
                    New
                  </Button>
                }
              />
            )}
          </OverviewCard>

          <OverviewCard
            title="Sales by channel"
            icon={<TrendingUp className="h-4 w-4" />}
            description="Where your orders come from · last 30 days"
            plain
          >
            {channels && channels.byChannel.length > 0 ? (
              channels.byChannel.map((c) => (
                <OverviewRow
                  key={c.channel}
                  icon={<TrendingUp className="h-4 w-4" />}
                  tone="module"
                  title={c.label}
                  hint={`${fmtNumber(c.orders)} order${c.orders === 1 ? '' : 's'} · ${c.sharePct}%`}
                  right={fmtMoneyCents(c.grossRevenueCents, currency)}
                />
              ))
            ) : (
              <EmptyState
                icon={<TrendingUp className="h-5 w-5" />}
                title="No channel sales yet"
                description="Orders broken down by channel will show here."
              />
            )}
          </OverviewCard>
        </div>
      </div>
    </div>
  );
}
