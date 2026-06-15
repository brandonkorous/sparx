import Link from 'next/link';
import {
  AlertTriangle,
  Box,
  Clock,
  Copy,
  DollarSign,
  Factory,
  Package,
  Percent,
  Plus,
  Route,
  Scale,
  TrendingUp,
  Truck,
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
  Timeline,
  TimelineItem,
  TimelineTime,
  TimelineTitle,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
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

// Dropship overview — the routing operator's morning glance: supplier-order
// throughput, the daily routing/exception queue, the margin the network is
// actually clearing, and supplier profitability. Headline KPIs, the margin
// breakdown, the per-supplier profitability table, and the orders-by-supplier
// split are wired to the live /v1/dropship/analytics summary; the order-volume
// chart reads the /v1/dropship/reports/orders-timeseries rollup; the on-time KPI
// reads /v1/dropship/reports/supplier-sla; the per-order margin table reads
// /v1/dropship/analytics/orders; the activity feed reads
// /v1/dropship/reports/activity (docs/97 §5). Each falls back to an illustrative
// example via liveOr until the tenant has routed orders. Sections with no
// backing model yet (reconciliation, routing rules) render sample data behind a
// <SampleBadge>.

export const dynamic = 'force-dynamic';

const MARGIN_ROW = 'grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.9fr]';
const TWO_COL_WIDE = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]';

// Live shapes from /v1/dropship/analytics (summary + per-supplier breakdown).
interface DropshipSupplierStat {
  supplierId: string;
  supplierName: string;
  orders: number;
  costCents: number;
  revenueCents: number;
  profitCents: number;
  marginPct: number;
}

interface DropshipSummary {
  totalOrders: number;
  costCents: number;
  revenueCents: number;
  profitCents: number;
  marginPct: number;
  bySupplier: DropshipSupplierStat[];
}

// Live shape from /v1/dropship/reports/orders-timeseries (rollup, docs/97 §5) —
// daily routed-order count + attributed revenue + supplier cost.
interface DropshipTimeseriesPoint {
  bucket: string;
  ordersCount: number;
  revenueCents: number;
  costCents: number;
  profitCents: number;
}

interface DropshipTimeseries {
  range: { from: string; to: string; grain: string };
  points: DropshipTimeseriesPoint[];
  totals: {
    ordersCount: number;
    revenueCents: number;
    costCents: number;
    profitCents: number;
    marginPct: number;
  };
  currency: string;
}

// Live shape from /v1/dropship/reports/supplier-sla — fulfillment timeliness.
interface DropshipSla {
  rangeLabel: string;
  onTimeDeliveryDays: number;
  routedOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  failedOrders: number;
  avgShipHours: number | null;
  avgDeliveryHours: number | null;
  fulfillmentRate: number;
  onTimeRate: number | null;
}

// Live shape from /v1/dropship/reports/activity — one routed order's last touch.
interface DropshipActivityItem {
  id: string;
  orderId: string;
  orderNumber: string | null;
  supplierId: string;
  supplierName: string;
  status: string;
  trackingNumber: string | null;
  updatedAt: string;
}

// Live shape from /v1/dropship/analytics/orders — per-order margin detail (paged
// rows; the overview surfaces the most recent page).
interface DropshipOrderRow {
  id: string;
  orderNumber: string | null;
  supplierName: string;
  status: string;
  revenueCents: number;
  costCents: number;
  profitCents: number;
  marginPct: number;
}

// The normalized timeline entry — shared by live activity + the sample fallback.
interface ActivityEntry {
  key: string;
  what: string;
  detail: string;
  when: string;
}

// The display row for the supplier table — shared by live + sample so liveOr can
// fall back cleanly.
interface SupplierRow {
  name: string;
  orders: number;
  revenueCents: number;
  profitCents: number;
  marginPct: number;
}

type StatusTone = 'neutral' | 'module' | 'success' | 'warning' | 'danger';

// Dropship-order lifecycle → badge label + tone, shared by the per-order margin
// table and the activity feed so a status reads identically in both.
const STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: 'Pending', tone: 'neutral' },
  submitted: { label: 'Routed', tone: 'module' },
  shipped: { label: 'Shipped', tone: 'warning' },
  delivered: { label: 'Delivered', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
};

function statusMeta(status: string): { label: string; tone: StatusTone } {
  return STATUS_META[status] ?? { label: status, tone: 'neutral' };
}

// Compact relative time for the activity feed (server-rendered, so `now` is the
// request time passed in).
function timeAgo(iso: string, nowMs: number): string {
  const mins = Math.round((nowMs - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Status badge derived from realized margin — drives both live and sample rows.
function marginTone(pct: number): { tone: 'success' | 'warning' | 'danger'; label: string } {
  if (pct >= 25) return { tone: 'success', label: 'Healthy' };
  if (pct >= 15) return { tone: 'warning', label: 'Watch' };
  return { tone: 'danger', label: 'At risk' };
}

// ── Sample data (illustrative until matching endpoints land) ──

// Order volume over the last 14 days (area chart series). Live via
// /v1/dropship/reports/orders-timeseries (rollup); this is the liveOr fallback
// until the tenant has routed orders.
const SAMPLE_VOLUME_14D: { label: string; routed: number }[] = [
  { label: 'May 31', routed: 26 },
  { label: 'Jun 1', routed: 22 },
  { label: 'Jun 2', routed: 30 },
  { label: 'Jun 3', routed: 24 },
  { label: 'Jun 4', routed: 31 },
  { label: 'Jun 5', routed: 27 },
  { label: 'Jun 6', routed: 34 },
  { label: 'Jun 7', routed: 29 },
  { label: 'Jun 8', routed: 38 },
  { label: 'Jun 9', routed: 33 },
  { label: 'Jun 10', routed: 41 },
  { label: 'Jun 11', routed: 36 },
  { label: 'Jun 12', routed: 44 },
  { label: 'Jun 13', routed: 42 },
];

// Supplier profitability — illustrative until the tenant has routed orders.
const SAMPLE_SUPPLIER_PROFIT: SupplierRow[] = [
  {
    name: 'Cascade Roasting Co.',
    orders: 189,
    revenueCents: 1_040_000,
    profitCents: 343_000,
    marginPct: 33,
  },
  {
    name: 'Andes Green Beans',
    orders: 124,
    revenueCents: 686_000,
    profitCents: 212_000,
    marginPct: 31,
  },
  {
    name: 'PourCraft Equipment',
    orders: 71,
    revenueCents: 392_000,
    profitCents: 86_000,
    marginPct: 22,
  },
  { name: 'Harvest Pantry', orders: 28, revenueCents: 162_000, profitCents: 18_000, marginPct: 11 },
];

// Donut color cycle for the live orders-by-supplier split (top suppliers first).
const DONUT_COLORS = [
  'module',
  'var(--module-active-tint)',
  '#6ee7b7',
  '#a7f3d0',
  '#d1fae5',
  '#ecfdf5',
];

// Orders by supplier (donut) — sample until the tenant has routed orders.
const SAMPLE_BY_SUPPLIER = [
  { label: 'Cascade', value: 189, color: 'module' as const },
  { label: 'Andes', value: 124, color: 'var(--module-active-tint)' },
  { label: 'PourCraft', value: 71, color: '#6ee7b7' },
  { label: 'Harvest', value: 28, color: '#d1fae5' },
];

// Routing rules.
const SAMPLE_ROUTING_RULES = [
  { title: 'Coffee beans → Cascade', hint: 'Primary supplier', icon: 'route' as const },
  { title: 'Green / unroasted → Andes', hint: 'Raw bean orders', icon: 'route' as const },
  { title: 'Equipment → PourCraft', hint: 'Brewers & accessories', icon: 'route' as const },
  { title: 'Fallback → lowest cost', hint: 'When no rule matches', icon: 'scale' as const },
] as const;

// Recent activity (timeline) — illustrative until the tenant has routed orders.
const SAMPLE_ACTIVITY: ActivityEntry[] = [
  { key: 'a1', what: 'Routed', detail: '#1042 → Cascade Roasting', when: '8m ago' },
  { key: 'a2', what: 'Shipped', detail: '#1038 → Andes Green Beans', when: '1h ago' },
  { key: 'a3', what: 'Delivered', detail: '#1031 → Cascade Roasting', when: '3h ago' },
  { key: 'a4', what: 'Failed', detail: '#1029 → PourCraft Equipment', when: '1d ago' },
];

// Recent routed orders (per-order margin) — illustrative until real orders exist.
const SAMPLE_RECENT_ORDERS: DropshipOrderRow[] = [
  {
    id: 's1',
    orderNumber: '#1042',
    supplierName: 'Cascade Roasting Co.',
    status: 'shipped',
    revenueCents: 8_400,
    costCents: 5_200,
    profitCents: 3_200,
    marginPct: 38,
  },
  {
    id: 's2',
    orderNumber: '#1041',
    supplierName: 'Andes Green Beans',
    status: 'delivered',
    revenueCents: 6_200,
    costCents: 4_300,
    profitCents: 1_900,
    marginPct: 31,
  },
  {
    id: 's3',
    orderNumber: '#1039',
    supplierName: 'PourCraft Equipment',
    status: 'submitted',
    revenueCents: 12_900,
    costCents: 10_100,
    profitCents: 2_800,
    marginPct: 22,
  },
  {
    id: 's4',
    orderNumber: '#1038',
    supplierName: 'Cascade Roasting Co.',
    status: 'delivered',
    revenueCents: 4_500,
    costCents: 2_900,
    profitCents: 1_600,
    marginPct: 36,
  },
];

export default async function DropshipPage() {
  await requireSession();

  const now = new Date();
  const range14 = `from=${encodeURIComponent(
    new Date(now.getTime() - 14 * 86_400_000).toISOString()
  )}&to=${encodeURIComponent(now.toISOString())}`;
  const range30 = `from=${encodeURIComponent(
    new Date(now.getTime() - 30 * 86_400_000).toISOString()
  )}&to=${encodeURIComponent(now.toISOString())}`;

  const [summary, volumeTs, sla, activity, recent] = await Promise.all([
    api.get<DropshipSummary>('/v1/dropship/analytics').catch(() => null),
    api
      .get<DropshipTimeseries>(`/v1/dropship/reports/orders-timeseries?${range14}&grain=day`)
      .catch(() => null),
    api.get<DropshipSla>(`/v1/dropship/reports/supplier-sla?${range30}`).catch(() => null),
    api.get<DropshipActivityItem[]>('/v1/dropship/reports/activity?limit=8').catch(() => null),
    api.get<DropshipOrderRow[]>('/v1/dropship/analytics/orders?take=8').catch(() => null),
  ]);

  // Live where the summary is reachable; fail soft to the mockup figures so the
  // page is reviewable before any dropship orders exist.
  const revenueCents = summary?.revenueCents ?? 2_280_000;
  const profitCents = summary?.profitCents ?? 710_000;
  const costCents = summary?.costCents ?? 1_570_000;
  const ordersRouted = summary?.totalOrders ?? 412;
  const marginPct = summary?.marginPct ?? 31;
  const isLive = summary != null;

  // Per-supplier profitability + orders split — live when the tenant has routed
  // orders, else an illustrative example (liveOr drops the badge once real).
  const liveSuppliers = summary?.bySupplier ?? null;
  const supplierRows = liveOr<SupplierRow[]>(
    liveSuppliers?.map((s) => ({
      name: s.supplierName,
      orders: s.orders,
      revenueCents: s.revenueCents,
      profitCents: s.profitCents,
      marginPct: s.marginPct,
    })) ?? null,
    SAMPLE_SUPPLIER_PROFIT
  );
  const bySupplierDonut = liveOr(
    liveSuppliers
      ?.slice(0, DONUT_COLORS.length)
      .map((s, i) => ({ label: s.supplierName, value: s.orders, color: DONUT_COLORS[i] })) ?? null,
    SAMPLE_BY_SUPPLIER
  );

  // Order-volume chart + footer: live the moment the tenant has any routed
  // orders in the window, else the illustrative sample (docs/97 §9). The
  // endpoint returns a continuous zero-filled daily series, so we gate on
  // totals.ordersCount.
  const volumePoints =
    volumeTs && volumeTs.totals.ordersCount > 0
      ? volumeTs.points.map((p) => ({
          label: new Date(`${p.bucket}T00:00:00Z`).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          }),
          routed: p.ordersCount,
        }))
      : null;
  const volume14d = liveOr(volumePoints, SAMPLE_VOLUME_14D);
  // When live, surface real totals from the same series; the sample footer keeps
  // the illustrative auto-route / ship-time figures (no endpoint backs those).
  const volumeFooter: [string, string][] =
    !volume14d.isSample && volumeTs
      ? [
          ['Routed', fmtNumber(volumeTs.totals.ordersCount)],
          ['Revenue', fmtMoneyCents(volumeTs.totals.revenueCents)],
          ['Margin', `${volumeTs.totals.marginPct}%`],
        ]
      : [
          ['Routed', fmtNumber(ordersRouted)],
          ['Auto-routed', '86%'],
          ['Avg ship', '2.4 days'],
        ];

  // On-time delivery KPI — live from the supplier-SLA report once any order has
  // been delivered (on-time %) / shipped (avg ship days); else the sample figures
  // so the strip stays populated for a fresh tenant.
  const avgShipDays = sla?.avgShipHours != null ? sla.avgShipHours / 24 : null;
  const onTimeValue = sla && sla.deliveredOrders > 0 ? fmtPercentRatio(sla.onTimeRate) : '94%';
  const onTimeHint =
    avgShipDays != null ? `Avg ship ${avgShipDays.toFixed(1)} days` : 'Avg ship 2.4 days';

  // Per-order margin table — live the moment the tenant has any routed orders,
  // else the illustrative sample.
  const recentOrders = liveOr<DropshipOrderRow[]>(recent, SAMPLE_RECENT_ORDERS);

  // Activity feed — normalize live lifecycle rows into timeline entries, falling
  // back to the sample until the tenant has routed orders.
  const activityEntries: ActivityEntry[] | null =
    activity?.map((a) => ({
      key: a.id,
      what: statusMeta(a.status).label,
      detail: `${a.orderNumber ?? '#—'} → ${a.supplierName}`,
      when: timeAgo(a.updatedAt, now.getTime()),
    })) ?? null;
  const activityFeed = liveOr<ActivityEntry[]>(activityEntries, SAMPLE_ACTIVITY);

  return (
    <Container size="xl">
      <Stack gap={6} className="py-8">
        <PageHeader
          icon={<Truck className="h-5 w-5" />}
          title="Dropship"
          description="Supplier orders & routing — last 30 days."
          actions={
            <>
              <Button asChild variant="outline" leftIcon={<Factory className="h-4 w-4" />}>
                <Link href="/dropship/suppliers">Suppliers</Link>
              </Button>
              <Button asChild variant="outline" leftIcon={<Scale className="h-4 w-4" />}>
                <Link href="/dropship/reconciliation">Reconciliation</Link>
              </Button>
              <Button asChild color="module" leftIcon={<Plus className="h-4 w-4" />}>
                <Link href="/dropship/suppliers/new">Add supplier</Link>
              </Button>
            </>
          }
        />

        {/* Headline KPIs — revenue, orders, margin are live; on-time is sample */}
        <Grid cols={1} mdCols={2} lgCols={4} gap={4}>
          <Stat
            icon={<DollarSign className="h-4 w-4" />}
            label="Dropship revenue · 30d"
            value={fmtMoneyCents(revenueCents)}
            hint="Across routed orders"
          />
          <Stat
            icon={<Route className="h-4 w-4" />}
            label="Orders routed · 30d"
            value={fmtNumber(ordersRouted)}
            hint="Routed to suppliers"
          />
          <Stat
            icon={<Percent className="h-4 w-4" />}
            label="Avg. margin"
            value={`${marginPct}%`}
            hint="Net of supplier cost"
          />
          <Stat
            icon={<Truck className="h-4 w-4" />}
            label="On-time delivery"
            value={onTimeValue}
            hint={onTimeHint}
          />
        </Grid>

        {/* Routing / exception queue */}
        <ActionQueue
          title="Needs attention"
          icon={<AlertTriangle className="h-4 w-4" />}
          meta={<SampleBadge />}
        >
          <ActionTile
            asChild
            icon={<Package className="h-5 w-5" />}
            count={9}
            label="Orders awaiting routing"
            tone="module"
          >
            <Link href="/dropship/products?status=awaiting_routing" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<AlertTriangle className="h-5 w-5" />}
            count={3}
            label="Failed routes"
            tone="danger"
          >
            <Link href="/dropship/products?status=failed" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Box className="h-5 w-5" />}
            count={5}
            label="Supplier stockouts"
            tone="warning"
          >
            <Link href="/dropship/products?status=stockout" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Truck className="h-5 w-5" />}
            count={7}
            label="Missing tracking"
            tone="warning"
          >
            <Link href="/dropship/products?status=missing_tracking" />
          </ActionTile>
        </ActionQueue>

        {/* Margin / profit (signature) + order volume */}
        <div className={MARGIN_ROW}>
          <OverviewCard
            title="Margin this month"
            icon={<DollarSign className="h-4 w-4" />}
            right={
              <Badge color="success" variant="soft">
                {marginPct}% margin
              </Badge>
            }
          >
            <p className="text-[1.65rem] leading-none font-medium">{fmtMoneyCents(profitCents)}</p>
            <p className="mt-1.5 mb-3 text-sm text-[var(--color-text-tertiary)]">
              Net profit on dropship orders ·{' '}
              <span className="text-[var(--color-text-secondary)]">last 30 days</span>
            </p>
            <OverviewRow
              icon={<DollarSign className="h-4 w-4" />}
              tone="success"
              title="Revenue"
              hint={`${fmtNumber(ordersRouted)} routed orders`}
              right={fmtMoneyCents(revenueCents)}
            />
            <OverviewRow
              icon={<Factory className="h-4 w-4" />}
              tone="warning"
              title="Supplier cost"
              hint="Wholesale & fulfillment"
              right={`−${fmtMoneyCents(costCents)}`}
            />
            <OverviewRow
              icon={<Truck className="h-4 w-4" />}
              tone="module"
              title="Shipping passthrough"
              hint="Billed to customer"
              right={fmtMoneyCents(0)}
            />
            <OverviewRow
              icon={<TrendingUp className="h-4 w-4" />}
              tone="success"
              title="Net margin"
              right={
                <span className="text-[var(--module-active-text)]">
                  {fmtMoneyCents(profitCents)}
                </span>
              }
            />
            {!isLive && (
              <div className="mt-3">
                <SampleBadge />
              </div>
            )}
          </OverviewCard>

          <OverviewCard
            title="Order volume"
            icon={<TrendingUp className="h-4 w-4" />}
            description="Orders routed · last 14 days"
            right={volume14d.isSample ? <SampleBadge reason="no-data" /> : undefined}
          >
            <AreaChart
              data={volume14d.data}
              series={[{ key: 'routed', label: 'Routed', color: 'module' }]}
              xKey="label"
              height={210}
              valueFormat="number"
              ariaLabel="Orders routed, last 14 days"
            />
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--color-border-default)] pt-3 text-sm">
              {volumeFooter.map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-[var(--color-text-tertiary)]">{label}</div>
                  <div className="font-medium">{value}</div>
                </div>
              ))}
            </div>
          </OverviewCard>
        </div>

        {/* Supplier health + reconciliation */}
        <div className={TWO_COL_WIDE}>
          <OverviewCard
            title="Top suppliers"
            icon={<Factory className="h-4 w-4" />}
            right={<CardLink href="/dropship/suppliers">All suppliers</CardLink>}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierRows.data.map((s) => {
                  const status = marginTone(s.marginPct);
                  return (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtNumber(s.orders)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtMoneyCents(s.revenueCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtMoneyCents(s.profitCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s.marginPct}%</TableCell>
                      <TableCell>
                        <Badge color={status.tone} variant="soft">
                          {status.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {supplierRows.isSample && (
              <div className="mt-3">
                <SampleBadge reason="no-data" />
              </div>
            )}
          </OverviewCard>

          <OverviewCard
            title="Reconciliation"
            icon={<Scale className="h-4 w-4" />}
            right={
              <Badge color="neutral" variant="soft">
                30d
              </Badge>
            }
          >
            <div className="mb-3 grid grid-cols-2 gap-3">
              <MetricTile value="388" label="Matched" />
              <MetricTile value="24" label="Unmatched" tone="warning" />
            </div>
            <OverviewRow
              icon={<AlertTriangle className="h-4 w-4" />}
              tone="warning"
              title="Cost discrepancies"
              hint="$640 · 3 invoices"
              right={
                <Badge color="warning" variant="soft">
                  Review
                </Badge>
              }
            />
            <OverviewRow
              icon={<Copy className="h-4 w-4" />}
              tone="danger"
              title="Duplicate charges"
              hint="1 flagged this period"
              right={
                <Badge color="danger" variant="soft">
                  1
                </Badge>
              }
            />
            <OverviewRow
              icon={<DollarSign className="h-4 w-4" />}
              tone="module"
              title="Credits pending"
              hint="Awaiting supplier issue"
              right={<span className="text-[var(--module-active-text)]">$210</span>}
            />
            <Button asChild variant="outline" size="sm" className="mt-4 w-full">
              <Link href="/dropship/reconciliation">Open reconciliation</Link>
            </Button>
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>
        </div>

        {/* Per-order margin — the routed orders behind the headline figures */}
        <OverviewCard
          title="Recent routed orders"
          icon={<Package className="h-4 w-4" />}
          description="Per-order margin · newest first"
          right={
            recentOrders.isSample ? (
              <SampleBadge reason="no-data" />
            ) : (
              <CardLink href="/dropship/analytics">Full report</CardLink>
            )
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.data.map((o) => {
                const meta = statusMeta(o.status);
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.orderNumber ?? '—'}</TableCell>
                    <TableCell className="truncate">{o.supplierName}</TableCell>
                    <TableCell>
                      <Badge color={meta.tone} variant="soft">
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoneyCents(o.revenueCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoneyCents(o.costCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoneyCents(o.profitCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{o.marginPct}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </OverviewCard>

        {/* Orders by supplier + routing rules + recent activity */}
        <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
          <OverviewCard
            title="Orders by supplier"
            icon={<Package className="h-4 w-4" />}
            right={<CardLink href="/dropship/analytics">Report</CardLink>}
          >
            <DonutChart
              data={bySupplierDonut.data}
              valueFormat="number"
              centerValue={fmtNumber(ordersRouted)}
              centerLabel="orders"
              ariaLabel="Orders by supplier"
            />
            {bySupplierDonut.isSample && (
              <div className="mt-3">
                <SampleBadge reason="no-data" />
              </div>
            )}
          </OverviewCard>

          <OverviewCard
            title="Routing rules"
            icon={<Route className="h-4 w-4" />}
            right={<CardLink href="/dropship/products">Manage</CardLink>}
          >
            {SAMPLE_ROUTING_RULES.map((r) => (
              <OverviewRow
                key={r.title}
                icon={
                  r.icon === 'route' ? <Route className="h-4 w-4" /> : <Scale className="h-4 w-4" />
                }
                tone="module"
                title={r.title}
                hint={r.hint}
                right={
                  <Badge color="success" variant="soft">
                    Active
                  </Badge>
                }
              />
            ))}
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>

          <OverviewCard
            title="Recent activity"
            icon={<Clock className="h-4 w-4" />}
            right={activityFeed.isSample ? <SampleBadge reason="no-data" /> : undefined}
          >
            <Timeline>
              {activityFeed.data.map((a, i) => (
                <TimelineItem key={a.key} showConnector={i < activityFeed.data.length - 1}>
                  <TimelineTitle>
                    <span className="font-medium">{a.what}</span>{' '}
                    <span className="font-normal text-[var(--color-text-secondary)]">
                      {a.detail}
                    </span>
                  </TimelineTitle>
                  <TimelineTime>{a.when}</TimelineTime>
                </TimelineItem>
              ))}
            </Timeline>
          </OverviewCard>
        </Grid>
      </Stack>
    </Container>
  );
}
