import Link from 'next/link';
import {
  AlertTriangle,
  Box,
  Boxes,
  CreditCard,
  Clock,
  DollarSign,
  Download,
  Package,
  Percent,
  Plus,
  RotateCcw,
  ShoppingCart,
  Star,
  Tag,
  TrendingUp,
  Users,
} from 'lucide-react';

import { requireSession } from '@sparx/auth';
import {
  ActionQueue,
  ActionTile,
  AreaChart,
  Badge,
  Button,
  Container,
  DonutChart,
  Grid,
  PageHeader,
  Stack,
  Stat,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { SAMPLE_REVENUE_14D } from '../_components/overview-charts';
import {
  CardLink,
  MetricTile,
  OverviewCard,
  OverviewRow,
  SampleBadge,
  fmtMoneyCents,
  fmtNumber,
  fmtPercentRatio,
  liveOr,
} from '../_components/overview-bits';

// Commerce overview — the storekeeper's morning glance: revenue pulse, the
// daily action queue, cashflow, and what's selling. Headline KPIs are wired to
// the live /v1/commerce/reports/* endpoints (fail-soft to "—"); sections whose
// reporting endpoints don't exist yet render representative data behind a
// <SampleBadge>, the dashboard's sanctioned interim (see overview-charts.tsx).

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

// ── Sample data (illustrative until the matching endpoints land) ──
const SAMPLE_ORDERS = [
  {
    id: '1042',
    customer: 'Maya Chen',
    total: '$64.00',
    status: 'To fulfill',
    tone: 'warning',
    when: '2m ago',
  },
  {
    id: '1041',
    customer: 'Devon Walls',
    total: '$38.50',
    status: 'To fulfill',
    tone: 'warning',
    when: '19m ago',
  },
  {
    id: '1040',
    customer: 'Priya Nair',
    total: '$112.00',
    status: 'Fulfilled',
    tone: 'success',
    when: '1h ago',
  },
  {
    id: '1039',
    customer: 'Theo Marsh',
    total: '$27.00',
    status: 'Pending',
    tone: 'neutral',
    when: '2h ago',
  },
  {
    id: '1038',
    customer: 'Rosa Iqbal',
    total: '$54.25',
    status: 'Fulfilled',
    tone: 'success',
    when: '3h ago',
  },
  {
    id: '1037',
    customer: 'Liam Park',
    total: '$41.00',
    status: 'Refunded',
    tone: 'danger',
    when: '5h ago',
  },
] as const;

const SAMPLE_TOP_PRODUCTS = [
  {
    name: 'Trailhead Blend · 12oz',
    meta: 'Whole bean',
    revenue: '$9,840',
    units: '312 sold',
    swatch: 'linear-gradient(135deg,#7c2d12,#b45309)',
  },
  {
    name: "Roaster's Pick",
    meta: 'Subscription',
    revenue: '$8,120',
    units: '204 active',
    swatch: 'linear-gradient(135deg,#92400e,#d97706)',
  },
  {
    name: 'Single-Origin Ethiopia',
    meta: 'Whole bean',
    revenue: '$6,430',
    units: '188 sold',
    swatch: 'linear-gradient(135deg,#3f2d1c,#78350f)',
  },
  {
    name: 'Cold Brew Concentrate',
    meta: '32oz',
    revenue: '$4,205',
    units: '141 sold',
    swatch: 'linear-gradient(135deg,#1c1917,#44403c)',
  },
  {
    name: 'Switchback Mug',
    meta: 'Ceramic',
    revenue: '$1,960',
    units: '98 sold',
    swatch: 'linear-gradient(135deg,#a16207,#ca8a04)',
  },
] as const;

const ORDER_TONE: Record<string, string> = {
  warning: 'warning',
  success: 'success',
  danger: 'danger',
  neutral: 'neutral',
};

export default async function CommercePage() {
  await requireSession();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const range = `from=${encodeURIComponent(thirtyDaysAgo.toISOString())}&to=${encodeURIComponent(now.toISOString())}`;
  const range14 = `from=${encodeURIComponent(fourteenDaysAgo.toISOString())}&to=${encodeURIComponent(now.toISOString())}`;

  const [revenue, funnel, subs, abandoned, revenueTs] = await Promise.all([
    api.get<RevenueSummary>(`/v1/commerce/reports/revenue-summary?${range}`).catch(() => null),
    api.get<ConversionFunnel>(`/v1/commerce/reports/conversion-funnel?${range}`).catch(() => null),
    api.get<SubscriptionMetrics>('/v1/commerce/reports/subscription-metrics').catch(() => null),
    api.get<AbandonedCarts>(`/v1/commerce/reports/abandoned-carts?${range}`).catch(() => null),
    api
      .get<RevenueTimeseries>(`/v1/commerce/reports/revenue-timeseries?${range14}&grain=day`)
      .catch(() => null),
  ]);
  const currency = revenue?.currency ?? 'USD';

  // Revenue chart + footer: live the moment the tenant has any orders in the
  // window, else the illustrative sample (docs/97 §9). The endpoint returns a
  // continuous zero-filled daily series, so we gate on totals.ordersCount.
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
  const revenue14d = liveOr(revenuePoints, SAMPLE_REVENUE_14D);
  const neg = (cents: number) =>
    cents > 0 ? `−${fmtMoneyCents(cents, currency)}` : fmtMoneyCents(cents, currency);
  const revenueFooter: [string, string][] =
    !revenue14d.isSample && revenueTs
      ? [
          ['Gross', fmtMoneyCents(revenueTs.totals.grossCents, currency)],
          ['Refunds', neg(revenueTs.totals.refundedCents)],
          ['Discounts', neg(revenueTs.totals.discountCents)],
          ['Net', fmtMoneyCents(revenueTs.totals.netCents, currency)],
        ]
      : [
          ['Gross', '$51,940'],
          ['Refunds', '−$1,820'],
          ['Discounts', '−$1,910'],
          ['Net', '$48,210'],
        ];

  return (
    <Container size="xl">
      <Stack gap={6} className="py-8">
        <PageHeader
          icon={<ShoppingCart className="h-5 w-5" />}
          title="Commerce"
          description="How your store is doing — last 30 days."
          actions={
            <>
              <Button asChild variant="outline" leftIcon={<Download className="h-4 w-4" />}>
                <Link href="/commerce/reports">Export</Link>
              </Button>
              <Button asChild variant="outline" leftIcon={<Tag className="h-4 w-4" />}>
                <Link href="/commerce/discounts/new">New discount</Link>
              </Button>
              <Button asChild color="module" leftIcon={<Plus className="h-4 w-4" />}>
                <Link href="/commerce/products/new">Add product</Link>
              </Button>
            </>
          }
        />

        {/* Headline KPIs — live */}
        <Grid cols={1} mdCols={2} lgCols={4} gap={4}>
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
        </Grid>

        {/* Daily action queue */}
        <ActionQueue
          title="Needs you today"
          icon={<AlertTriangle className="h-4 w-4" />}
          meta={<SampleBadge />}
        >
          <ActionTile
            asChild
            icon={<Package className="h-5 w-5" />}
            count={18}
            label="Orders to fulfill"
            tone="module"
          >
            <Link href="/commerce/orders" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Boxes className="h-5 w-5" />}
            count={5}
            label="Low / out of stock"
            tone="warning"
          >
            <Link href="/commerce/inventory" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<RotateCcw className="h-5 w-5" />}
            count={3}
            label="Returns to review"
            tone="danger"
          >
            <Link href="/commerce/returns" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Star className="h-5 w-5" />}
            count={7}
            label="Reviews to moderate"
            tone="success"
          >
            <Link href="/commerce/reviews" />
          </ActionTile>
        </ActionQueue>

        {/* Revenue + payouts */}
        <div className={TWO_COL}>
          <OverviewCard
            title="Revenue"
            icon={<TrendingUp className="h-4 w-4" />}
            description="Net sales, last 14 days"
            right={revenue14d.isSample ? <SampleBadge reason="no-data" /> : undefined}
          >
            <AreaChart
              data={revenue14d.data}
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
          </OverviewCard>

          <OverviewCard
            title="Payouts"
            icon={<CreditCard className="h-4 w-4" />}
            right={<SampleBadge />}
          >
            <p className="text-[1.65rem] leading-none font-medium">$4,210.50</p>
            <p className="mt-1.5 mb-3 text-sm text-[var(--color-text-tertiary)]">
              Next payout · arrives{' '}
              <span className="text-[var(--color-text-secondary)]">Jun 16</span>
            </p>
            <OverviewRow
              icon={<DollarSign className="h-4 w-4" />}
              tone="success"
              title="Available balance"
              hint="Ready to pay out"
              right="$1,890.20"
            />
            <OverviewRow
              icon={<Clock className="h-4 w-4" />}
              tone="warning"
              title="In transit"
              hint="Settling from card sales"
              right="$4,210.50"
            />
            <OverviewRow
              icon={<RotateCcw className="h-4 w-4" />}
              tone="module"
              title="Reserved for refunds"
              right="$320.00"
            />
            <Button asChild variant="outline" size="sm" className="mt-4 w-full">
              <Link href="/settings/payments">View payout schedule</Link>
            </Button>
          </OverviewCard>
        </div>

        {/* Recent orders + top products */}
        <div className={TWO_COL_WIDE}>
          <OverviewCard
            title="Recent orders"
            icon={<ShoppingCart className="h-4 w-4" />}
            right={<CardLink href="/commerce/orders">All orders</CardLink>}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_ORDERS.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs text-[var(--module-active-text)]">
                      #{o.id}
                    </TableCell>
                    <TableCell className="font-medium">{o.customer}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.total}</TableCell>
                    <TableCell>
                      <Badge color={ORDER_TONE[o.tone]} variant="soft">
                        {o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-[var(--color-text-tertiary)] tabular-nums">
                      {o.when}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>

          <OverviewCard
            title="Top products"
            icon={<TrendingUp className="h-4 w-4" />}
            right={<CardLink href="/commerce/reports">Report</CardLink>}
          >
            <div className="flex flex-col">
              {SAMPLE_TOP_PRODUCTS.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-3 border-b border-[var(--color-border-default)] py-2.5 last:border-b-0"
                >
                  <span
                    aria-hidden
                    className="h-9 w-9 shrink-0 rounded-md"
                    style={{ background: p.swatch }}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-[var(--color-text-tertiary)]">{p.meta}</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-sm font-medium tabular-nums">{p.revenue}</div>
                    <div className="text-xs text-[var(--color-text-tertiary)]">{p.units}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>
        </div>

        {/* Customers + inventory + recover & grow */}
        <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
          <OverviewCard
            title="Customers"
            icon={<Users className="h-4 w-4" />}
            right={<CardLink href="/crm/customers">CRM</CardLink>}
          >
            <DonutChart
              data={[
                { label: 'Returning', value: 62, color: 'module' },
                { label: 'New', value: 38, color: 'var(--module-active-tint)' },
              ]}
              valueFormat="percent"
              centerValue="62%"
              centerLabel="returning"
              ariaLabel="New vs returning customers"
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MetricTile value="486" label="New · 30d" />
              <MetricTile value="$96" label="Avg. lifetime value" />
            </div>
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>

          <OverviewCard
            title="Inventory"
            icon={<Box className="h-4 w-4" />}
            right={<CardLink href="/commerce/inventory">Manage</CardLink>}
          >
            <div className="mb-3 grid grid-cols-3 gap-3 text-center">
              <MetricTile value="142" label="In stock" />
              <MetricTile value="5" label="Low" tone="warning" />
              <MetricTile value="2" label="Out" tone="danger" />
            </div>
            <OverviewRow
              icon={<AlertTriangle className="h-4 w-4" />}
              tone="danger"
              title="Switchback Mug"
              hint="Out of stock"
              right={
                <Badge color="danger" variant="soft">
                  Restock
                </Badge>
              }
            />
            <OverviewRow
              icon={<Box className="h-4 w-4" />}
              tone="warning"
              title="Cold Brew Concentrate"
              hint="3 left · sells ~6/day"
              right={
                <Badge color="warning" variant="soft">
                  Low
                </Badge>
              }
            />
            <OverviewRow
              icon={<Box className="h-4 w-4" />}
              tone="warning"
              title="Single-Origin Ethiopia"
              hint="8 left"
              right={
                <Badge color="warning" variant="soft">
                  Low
                </Badge>
              }
            />
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>

          <OverviewCard title="Recover & grow" icon={<ShoppingCart className="h-4 w-4" />}>
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
            <OverviewRow
              icon={<Tag className="h-4 w-4" />}
              tone="module"
              title="SUMMER15 discount"
              hint="$3,110 in sales · 84 uses"
              right={
                <Badge color="success" variant="soft">
                  Active
                </Badge>
              }
            />
            <div className="mt-3 flex items-center gap-2">
              <SampleBadge />
              <span className="text-xs text-[var(--color-text-tertiary)]">
                Discount figures illustrative
              </span>
            </div>
          </OverviewCard>
        </Grid>
      </Stack>
    </Container>
  );
}
