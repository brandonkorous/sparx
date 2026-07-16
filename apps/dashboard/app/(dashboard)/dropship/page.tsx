import Link from 'next/link';
import {
  AlertTriangle,
  Clock,
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
  DonutChart,
  PageHeader,
  Timeline,
  TimelineItem,
  TimelineTime,
  TimelineTitle,
} from '@sparx/ui';
import {
  Badge,
  Button,
  EmptyState,
  Stat,
  StatDesc,
  StatFigure,
  Stats,
  StatTitle,
  StatValue,
  Table,
} from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';
import {
  CardLink,
  OverviewCard,
  OverviewRow,
  fmtMoneyCents,
  fmtNumber,
  fmtPercentRatio,
} from '../_components/overview-bits';

// Dropship overview — the routing operator's morning glance: supplier-order
// throughput, the daily routing/exception queue, the margin the network is
// actually clearing, and supplier profitability. Headline KPIs, the margin
// breakdown, the per-supplier profitability table, and the orders-by-supplier
// split are wired to the live /v1/dropship/analytics summary; the order-volume
// chart reads the /v1/dropship/reports/orders-timeseries rollup; the on-time KPI
// reads /v1/dropship/reports/supplier-sla; the per-order margin table reads
// /v1/dropship/analytics/orders; the activity feed reads
// /v1/dropship/reports/activity (docs/97 §5). Each section renders a compact
// empty state until the tenant has routed orders.

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

// Status badge derived from realized margin — drives the supplier health column.
function marginTone(pct: number): { tone: 'success' | 'warning' | 'danger'; label: string } {
  if (pct >= 25) return { tone: 'success', label: 'Healthy' };
  if (pct >= 15) return { tone: 'warning', label: 'Watch' };
  return { tone: 'danger', label: 'At risk' };
}

// Donut color cycle for the live orders-by-supplier split (top suppliers first).
const DONUT_COLORS = [
  'module',
  'color-mix(in oklch, var(--color-module) 15%, transparent)',
  '#6ee7b7',
  '#a7f3d0',
  '#d1fae5',
  '#ecfdf5',
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

  // Headline figures — live from the analytics summary, em dash until any
  // dropship order has been routed.
  const hasSummary = summary != null && summary.totalOrders > 0;
  const revenueCents = summary?.revenueCents ?? null;
  const profitCents = summary?.profitCents ?? null;
  const costCents = summary?.costCents ?? null;
  const ordersRouted = summary?.totalOrders ?? null;
  const marginPct = summary?.marginPct ?? null;

  // Per-supplier profitability + orders split — live when the tenant has routed
  // orders, else an empty state.
  const liveSuppliers = summary?.bySupplier ?? [];
  const supplierRows = liveSuppliers.map((s) => ({
    name: s.supplierName,
    orders: s.orders,
    revenueCents: s.revenueCents,
    profitCents: s.profitCents,
    marginPct: s.marginPct,
  }));
  const bySupplierDonut = liveSuppliers
    .slice(0, DONUT_COLORS.length)
    .map((s, i) => ({ label: s.supplierName, value: s.orders, color: DONUT_COLORS[i] }));

  // Order-volume chart + footer: live the moment the tenant has any routed
  // orders in the window. The endpoint returns a continuous zero-filled daily
  // series, so we gate on totals.ordersCount.
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
      : [];
  const volumeFooter: [string, string][] =
    volumeTs && volumeTs.totals.ordersCount > 0
      ? [
          ['Routed', fmtNumber(volumeTs.totals.ordersCount)],
          ['Revenue', fmtMoneyCents(volumeTs.totals.revenueCents)],
          ['Margin', `${volumeTs.totals.marginPct}%`],
        ]
      : [];

  // On-time delivery KPI — live from the supplier-SLA report once any order has
  // been delivered (on-time %) / shipped (avg ship days).
  const avgShipDays = sla?.avgShipHours != null ? sla.avgShipHours / 24 : null;
  const onTimeValue = sla && sla.deliveredOrders > 0 ? fmtPercentRatio(sla.onTimeRate) : '—';
  const onTimeHint =
    avgShipDays != null ? `Avg ship ${avgShipDays.toFixed(1)} days` : 'Once orders deliver';

  // Per-order margin table — live the moment the tenant has any routed orders.
  const recentOrders = recent ?? [];

  // Activity feed — normalize live lifecycle rows into timeline entries.
  const activityEntries = (activity ?? []).map((a) => ({
    key: a.id,
    what: statusMeta(a.status).label,
    detail: `${a.orderNumber ?? '#—'} → ${a.supplierName}`,
    when: timeAgo(a.updatedAt, now.getTime()),
  }));

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-8">
        <PageHeader
          icon={<Truck className="h-5 w-5" />}
          title="Dropship"
          description="Supplier orders & routing — last 30 days."
          actions={
            <>
              <Button
                variant="outline"
                iconStart={<Factory className="h-4 w-4" />}
                render={<Link href="/dropship/suppliers" />}
              >
                Suppliers
              </Button>
              <Button
                variant="outline"
                iconStart={<Scale className="h-4 w-4" />}
                render={<Link href="/dropship/reconciliation" />}
              >
                Reconciliation
              </Button>
              <Button
                color="module"
                iconStart={<Plus className="h-4 w-4" />}
                render={<Link href="/dropship/suppliers/new" />}
              >
                Add supplier
              </Button>
            </>
          }
        />

        {/* Headline KPIs — revenue, orders, margin from the analytics summary;
            on-time from the supplier-SLA report. */}
        <Stats className="w-full flex-wrap [&>*]:flex-1">
          <Stat>
            <StatFigure>
              <div className="bg-module bg-soft text-module rounded-md p-1.5">
                <DollarSign className="h-4 w-4" />
              </div>
            </StatFigure>
            <StatTitle>Dropship revenue · 30d</StatTitle>
            <StatValue>{fmtMoneyCents(revenueCents)}</StatValue>
            <StatDesc>Across routed orders</StatDesc>
          </Stat>
          <Stat>
            <StatFigure>
              <div className="bg-module bg-soft text-module rounded-md p-1.5">
                <Route className="h-4 w-4" />
              </div>
            </StatFigure>
            <StatTitle>Orders routed · 30d</StatTitle>
            <StatValue>{fmtNumber(ordersRouted)}</StatValue>
            <StatDesc>Routed to suppliers</StatDesc>
          </Stat>
          <Stat>
            <StatFigure>
              <div className="bg-module bg-soft text-module rounded-md p-1.5">
                <Percent className="h-4 w-4" />
              </div>
            </StatFigure>
            <StatTitle>Avg. margin</StatTitle>
            <StatValue>{marginPct != null ? `${marginPct}%` : '—'}</StatValue>
            <StatDesc>Net of supplier cost</StatDesc>
          </Stat>
          <Stat>
            <StatFigure>
              <div className="bg-module bg-soft text-module rounded-md p-1.5">
                <Truck className="h-4 w-4" />
              </div>
            </StatFigure>
            <StatTitle>On-time delivery</StatTitle>
            <StatValue>{onTimeValue}</StatValue>
            <StatDesc>{onTimeHint}</StatDesc>
          </Stat>
        </Stats>

        {/* Routing / exception queue — the one wireable tile is failed routes
            from the supplier-SLA report; it only renders once any have failed. */}
        {sla && sla.failedOrders > 0 && (
          <ActionQueue
            title="Needs attention"
            icon={<AlertTriangle className="h-4 w-4" />}
            columns={2}
          >
            <ActionTile
              asChild
              icon={<AlertTriangle className="h-5 w-5" />}
              count={fmtNumber(sla.failedOrders)}
              label="Failed routes"
              tone="danger"
            >
              <Link href="/dropship/products?status=failed" />
            </ActionTile>
          </ActionQueue>
        )}

        {/* Margin / profit (signature) + order volume */}
        <div className={MARGIN_ROW}>
          <OverviewCard
            title="Margin this month"
            icon={<DollarSign className="h-4 w-4" />}
            right={
              marginPct != null ? (
                <Badge color="success" variant="soft">
                  {marginPct}% margin
                </Badge>
              ) : undefined
            }
          >
            {hasSummary ? (
              <>
                <p className="text-[1.65rem] leading-none font-medium">
                  {fmtMoneyCents(profitCents)}
                </p>
                <p className="text-base-content mt-1.5 mb-3 text-sm">
                  Net profit on dropship orders ·{' '}
                  <span className="text-base-content">last 30 days</span>
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
                  right={<span className="text-module">{fmtMoneyCents(profitCents)}</span>}
                />
              </>
            ) : (
              <EmptyState
                icon={<DollarSign className="h-5 w-5" />}
                title="No margin yet"
                description="Revenue, cost, and net margin appear once you route orders."
              />
            )}
          </OverviewCard>

          <OverviewCard
            title="Order volume"
            icon={<TrendingUp className="h-4 w-4" />}
            description="Orders routed · last 14 days"
            plain
          >
            {volumePoints.length ? (
              <>
                <AreaChart
                  data={volumePoints}
                  series={[{ key: 'routed', label: 'Routed', color: 'module' }]}
                  xKey="label"
                  height={210}
                  valueFormat="number"
                  ariaLabel="Orders routed, last 14 days"
                />
                <div className="border-base-300 mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t pt-3 text-sm">
                  {volumeFooter.map(([label, value]) => (
                    <div key={label}>
                      <div className="text-base-content text-xs">{label}</div>
                      <div className="font-medium">{value}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                icon={<TrendingUp className="h-5 w-5" />}
                title="No routed orders yet"
                description="Daily routed-order volume charts here as orders flow."
              />
            )}
          </OverviewCard>
        </div>

        {/* Supplier health + per-order margin */}
        <div className={TWO_COL_WIDE}>
          <OverviewCard
            title="Top suppliers"
            icon={<Factory className="h-4 w-4" />}
            right={<CardLink href="/dropship/suppliers">All suppliers</CardLink>}
            plain
          >
            {supplierRows.length ? (
              <Table>
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th className="text-right">Orders</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Profit</th>
                    <th className="text-right">Margin</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierRows.map((s) => {
                    const status = marginTone(s.marginPct);
                    return (
                      <tr key={s.name}>
                        <td className="font-medium">{s.name}</td>
                        <td className="text-right tabular-nums">{fmtNumber(s.orders)}</td>
                        <td className="text-right tabular-nums">{fmtMoneyCents(s.revenueCents)}</td>
                        <td className="text-right tabular-nums">{fmtMoneyCents(s.profitCents)}</td>
                        <td className="text-right tabular-nums">{s.marginPct}%</td>
                        <td>
                          <Badge color={status.tone} variant="soft">
                            {status.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <EmptyState
                icon={<Factory className="h-5 w-5" />}
                title="No suppliers yet"
                description="Supplier profitability ranks here once you route orders."
                actions={
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href="/dropship/suppliers/new" />}
                  >
                    Add supplier
                  </Button>
                }
              />
            )}
          </OverviewCard>

          <OverviewCard
            title="Orders by supplier"
            icon={<Package className="h-4 w-4" />}
            right={<CardLink href="/dropship/analytics">Report</CardLink>}
            plain
          >
            {bySupplierDonut.length ? (
              <DonutChart
                data={bySupplierDonut}
                valueFormat="number"
                centerValue={fmtNumber(ordersRouted)}
                centerLabel="orders"
                ariaLabel="Orders by supplier"
              />
            ) : (
              <EmptyState
                icon={<Package className="h-5 w-5" />}
                title="No orders yet"
                description="The split of routed orders by supplier shows here."
              />
            )}
          </OverviewCard>
        </div>

        {/* Per-order margin — the routed orders behind the headline figures */}
        <OverviewCard
          title="Recent routed orders"
          icon={<Package className="h-4 w-4" />}
          description="Per-order margin · newest first"
          right={<CardLink href="/dropship/analytics">Full report</CardLink>}
          plain
        >
          {recentOrders.length ? (
            <Table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Cost</th>
                  <th className="text-right">Profit</th>
                  <th className="text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => {
                  const meta = statusMeta(o.status);
                  return (
                    <tr key={o.id}>
                      <td className="font-medium">{o.orderNumber ?? '—'}</td>
                      <td className="truncate">{o.supplierName}</td>
                      <td>
                        <Badge color={meta.tone} variant="soft">
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="text-right tabular-nums">{fmtMoneyCents(o.revenueCents)}</td>
                      <td className="text-right tabular-nums">{fmtMoneyCents(o.costCents)}</td>
                      <td className="text-right tabular-nums">{fmtMoneyCents(o.profitCents)}</td>
                      <td className="text-right tabular-nums">{o.marginPct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          ) : (
            <EmptyState
              icon={<Package className="h-5 w-5" />}
              title="No routed orders yet"
              description="Each routed order's realized margin lists here, newest first."
            />
          )}
        </OverviewCard>

        {/* Routing rules + recent activity */}
        <div className={TWO_COL_WIDE}>
          <OverviewCard
            title="Routing rules"
            icon={<Route className="h-4 w-4" />}
            right={<CardLink href="/dropship/products">Manage</CardLink>}
            plain
          >
            <EmptyState
              icon={<Route className="h-5 w-5" />}
              title="No routing rules yet"
              description="Map products to suppliers so orders route automatically."
              actions={
                <Button variant="outline" size="sm" render={<Link href="/dropship/products" />}>
                  Set up routing
                </Button>
              }
            />
          </OverviewCard>

          <OverviewCard title="Recent activity" icon={<Clock className="h-4 w-4" />} plain>
            {activityEntries.length ? (
              <Timeline>
                {activityEntries.map((a, i) => (
                  <TimelineItem key={a.key} showConnector={i < activityEntries.length - 1}>
                    <TimelineTitle>
                      <span className="font-medium">{a.what}</span>{' '}
                      <span className="text-base-content font-normal">{a.detail}</span>
                    </TimelineTitle>
                    <TimelineTime>{a.when}</TimelineTime>
                  </TimelineItem>
                ))}
              </Timeline>
            ) : (
              <EmptyState
                icon={<Clock className="h-5 w-5" />}
                title="No recent activity"
                description="Routing, shipping, and delivery updates appear here."
              />
            )}
          </OverviewCard>
        </div>
      </div>
    </div>
  );
}
