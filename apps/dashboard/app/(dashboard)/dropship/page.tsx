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
} from '../_components/overview-bits';

// Dropship overview — the routing operator's morning glance: supplier-order
// throughput, the daily routing/exception queue, the margin the network is
// actually clearing, and supplier health. Headline KPIs and the margin
// breakdown are wired to the live /v1/dropship/analytics summary (fail-soft to
// the representative figures below); sections without a backing endpoint yet
// (on-time delivery, the supplier-health table, reconciliation, routing rules,
// the activity feed) render sample data behind a <SampleBadge>.

export const dynamic = 'force-dynamic';

const MARGIN_ROW = 'grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.9fr]';
const TWO_COL_WIDE = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]';

// Live summary shape from /v1/dropship/analytics (see dropship/analytics/page).
interface DropshipSummary {
  totalOrders: number;
  costCents: number;
  revenueCents: number;
  profitCents: number;
  marginPct: number;
}

// ── Sample data (illustrative until matching endpoints land) ──

// Order volume over the last 14 days (area chart series). No live timeseries
// endpoint yet — replace with /v1/dropship/reports/*-timeseries when it lands.
const SAMPLE_VOLUME_14D = [
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
] as const;

// Supplier health — names carried from the mockup.
const SAMPLE_SUPPLIERS = [
  {
    name: 'Cascade Roasting Co.',
    orders: '189',
    onTime: '96%',
    fill: '98%',
    avgShip: '1.9d',
    status: 'Healthy',
    tone: 'success' as const,
  },
  {
    name: 'Andes Green Beans',
    orders: '124',
    onTime: '93%',
    fill: '95%',
    avgShip: '2.6d',
    status: 'Healthy',
    tone: 'success' as const,
  },
  {
    name: 'PourCraft Equipment',
    orders: '71',
    onTime: '88%',
    fill: '90%',
    avgShip: '3.4d',
    status: 'Watch',
    tone: 'warning' as const,
  },
  {
    name: 'Harvest Pantry',
    orders: '28',
    onTime: '79%',
    fill: '84%',
    avgShip: '4.1d',
    status: 'At risk',
    tone: 'danger' as const,
  },
] as const;

// Orders by supplier (donut).
const SAMPLE_BY_SUPPLIER = [
  { label: 'Cascade', value: 46, color: 'module' as const },
  { label: 'Andes', value: 30, color: 'var(--module-active-tint)' },
  { label: 'PourCraft', value: 18, color: '#6ee7b7' },
  { label: 'Harvest', value: 6, color: '#d1fae5' },
];

// Routing rules.
const SAMPLE_ROUTING_RULES = [
  { title: 'Coffee beans → Cascade', hint: 'Primary supplier', icon: 'route' as const },
  { title: 'Green / unroasted → Andes', hint: 'Raw bean orders', icon: 'route' as const },
  { title: 'Equipment → PourCraft', hint: 'Brewers & accessories', icon: 'route' as const },
  { title: 'Fallback → lowest cost', hint: 'When no rule matches', icon: 'scale' as const },
] as const;

// Recent activity (timeline).
const SAMPLE_ACTIVITY = [
  { what: 'Order routed', detail: '#1042 → Cascade Roasting', when: '8m ago' },
  { what: 'Tracking received', detail: '#1038 (Andes)', when: '1h ago' },
  { what: 'Stockout', detail: 'PourCraft — Pour-over kit', when: '3h ago' },
  { what: 'Reconciled', detail: '12 invoices (Cascade)', when: '1 day ago' },
] as const;

export default async function DropshipPage() {
  await requireSession();

  const summary = await api.get<DropshipSummary>('/v1/dropship/analytics').catch(() => null);

  // Live where the summary is reachable; fail soft to the mockup figures so the
  // page is reviewable before any dropship orders exist.
  const revenueCents = summary?.revenueCents ?? 2_280_000;
  const profitCents = summary?.profitCents ?? 710_000;
  const costCents = summary?.costCents ?? 1_570_000;
  const ordersRouted = summary?.totalOrders ?? 412;
  const marginPct = summary?.marginPct ?? 31;
  const isLive = summary != null;

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
            value="94%"
            hint="Avg ship 2.4 days"
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
            right={<SampleBadge />}
          >
            <AreaChart
              data={[...SAMPLE_VOLUME_14D]}
              series={[{ key: 'routed', label: 'Routed', color: 'module' }]}
              xKey="label"
              height={210}
              valueFormatter={(v) => fmtNumber(v)}
              ariaLabel="Orders routed, last 14 days"
            />
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--color-border-default)] pt-3 text-sm">
              {[
                ['Routed', fmtNumber(ordersRouted)],
                ['Auto-routed', '86%'],
                ['Avg ship', '2.4 days'],
              ].map(([label, value]) => (
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
            title="Supplier health"
            icon={<Factory className="h-4 w-4" />}
            right={<CardLink href="/dropship/suppliers">All suppliers</CardLink>}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">On-time</TableHead>
                  <TableHead className="text-right">Fill rate</TableHead>
                  <TableHead className="text-right">Avg ship</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_SUPPLIERS.map((s) => (
                  <TableRow key={s.name}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.orders}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.onTime}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.fill}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.avgShip}</TableCell>
                    <TableCell>
                      <Badge color={s.tone} variant="soft">
                        {s.status}
                      </Badge>
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

        {/* Orders by supplier + routing rules + recent activity */}
        <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
          <OverviewCard
            title="Orders by supplier"
            icon={<Package className="h-4 w-4" />}
            right={<CardLink href="/dropship/analytics">Report</CardLink>}
          >
            <DonutChart
              data={SAMPLE_BY_SUPPLIER}
              valueFormatter={(v) => `${v}%`}
              centerValue={fmtNumber(ordersRouted)}
              centerLabel="orders"
              ariaLabel="Orders by supplier"
            />
            <div className="mt-3">
              <SampleBadge />
            </div>
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

          <OverviewCard title="Recent activity" icon={<Clock className="h-4 w-4" />}>
            <Timeline>
              {SAMPLE_ACTIVITY.map((a, i) => (
                <TimelineItem key={`${a.what}-${i}`} showConnector={i < SAMPLE_ACTIVITY.length - 1}>
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
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>
        </Grid>
      </Stack>
    </Container>
  );
}
