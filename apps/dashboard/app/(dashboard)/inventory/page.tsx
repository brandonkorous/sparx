import Link from 'next/link';
import {
  AlertTriangle,
  Box,
  Boxes,
  DollarSign,
  History,
  MapPin,
  Package,
  Plus,
  SlidersHorizontal,
  Truck,
  Warehouse,
} from 'lucide-react';

import { requireSession } from '@sparx/auth';
import {
  ActionQueue,
  ActionTile,
  AreaChart,
  Badge,
  BarList,
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
import { EntityCreateButton } from '../_components/entity-create-button';
import {
  CardLink,
  MetricTile,
  OverviewCard,
  OverviewRow,
  SampleBadge,
  fmtMoneyCents,
  fmtNumber,
  liveOr,
} from '../_components/overview-bits';

// Inventory overview — the stock-keeper's glance: what's in stock, what's low,
// what it's worth, and what needs reordering. Inventory's module color is Amber
// — which is ALSO the semantic warning hue — so amber drives the module chrome
// while OUT-OF-STOCK stays unmistakably red (danger) and "low" reads as a
// warning badge. Valuation, stock-status counts, the low/out table, per-location
// quantities, source-feed health, the recent-change feed, and the value-over-
// time chart are wired LIVE to /v1/inventory/reports/* (fail-soft to "—" / badged
// sample). The value chart reads daily valuation snapshots
// (rollup_inventory_daily_valuation) + a live-overlay of today, so it builds
// forward from first capture. Purchase orders (no PO model) stay sample — they
// need backing data the module doesn't capture yet. The inventory layout wraps
// this in <ModuleProvider module="inventory">.

export const dynamic = 'force-dynamic';

const TWO_COL = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.9fr_1fr]';

// Amber donut/bar palette (inventory module color + tints).
const LOCATION_COLORS = ['module', '#fbbf24', '#fcd34d', '#fde68a', '#fef3c7'];

interface InventoryLocation {
  id: string;
  name: string;
}
interface InventorySourceRow {
  id: string;
  name: string;
  status: string;
  lastSyncAt: string | null;
}
interface InventorySummary {
  valuation: {
    totalUnits: number;
    totalAllocated: number;
    totalAvailable: number;
    totalCostCents: number;
    totalRetailCents: number;
    currency: string;
  };
  stockStatus: { skuCount: number; outOfStock: number; lowStock: number; healthy: number };
  byLocation: {
    warehouseId: string;
    name: string;
    type: string;
    skuCount: number;
    onHand: number;
    available: number;
  }[];
  sources: {
    total: number;
    active: number;
    paused: number;
    error: number;
    lastSyncAt: string | null;
  };
  lowOrOut: {
    variantId: string;
    sku: string;
    title: string;
    location: string;
    onHand: number;
    available: number;
    status: string;
  }[];
  lowStockThreshold: number;
}
interface InventoryActivityRow {
  id: string;
  variantId: string;
  warehouseId: string;
  sku: string;
  title: string;
  location: string;
  delta: number;
  balanceAfter: number | null;
  reason: string;
  createdAt: string;
}

// Movement reason → short human label for the activity feed.
const REASON_LABELS: Record<string, string> = {
  sale: 'Sale',
  return: 'Return',
  recount: 'Recount',
  loss: 'Loss',
  damage: 'Damage',
  transfer_in: 'Transfer in',
  transfer_out: 'Transfer out',
  receive: 'Received',
  reserve: 'Reserved',
  release: 'Released',
  manual: 'Manual',
  sync: 'Synced',
};

function signed(n: number): string {
  return n > 0 ? `+${fmtNumber(n)}` : fmtNumber(n);
}
interface ValuationTimeseries {
  range: { from: string; to: string };
  points: { bucket: string; units: number; costCents: number; retailCents: number }[];
}

// ── Sample data (shown badged only until the tenant has stock data) ──
const SAMPLE_VALUE_14D = [
  { label: 'May 31', value: 119400 },
  { label: 'Jun 1', value: 120800 },
  { label: 'Jun 2', value: 122100 },
  { label: 'Jun 3', value: 121300 },
  { label: 'Jun 4', value: 123600 },
  { label: 'Jun 5', value: 122900 },
  { label: 'Jun 6', value: 124800 },
  { label: 'Jun 7', value: 123700 },
  { label: 'Jun 8', value: 125900 },
  { label: 'Jun 9', value: 125100 },
  { label: 'Jun 10', value: 127200 },
  { label: 'Jun 11', value: 126400 },
  { label: 'Jun 12', value: 128000 },
  { label: 'Jun 13', value: 128400 },
] as const;

const SAMPLE_BY_LOCATION: { label: string; value: number; color?: string }[] = [
  { label: 'Main', value: 5710, color: 'module' },
  { label: 'Retail', value: 2360, color: '#fbbf24' },
  { label: '3PL', value: 1770, color: '#fcd34d' },
];

const SAMPLE_POS = [
  { name: 'PO-218 · Cascade', when: 'Arrives Jun 18', units: '1,200' },
  { name: 'PO-217 · Andes', when: 'Arrives Jun 21', units: '800' },
  { name: 'PO-215 · PourCraft', when: 'Arrives Jun 24', units: '60' },
] as const;

// Short UTC day label ("Jun 13") for the value-over-time chart x-axis.
function shortDay(bucket: string): string {
  return new Date(`${bucket}T00:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

export default async function InventoryPage() {
  await requireSession();

  const [locations, sources, summary, activity, valueSeries] = await Promise.all([
    api.getPaged<InventoryLocation[]>('/v1/inventory/locations?take=20').catch(() => null),
    api.getPaged<InventorySourceRow[]>('/v1/inventory/sources?take=20').catch(() => null),
    api.get<InventorySummary>('/v1/inventory/reports/summary').catch(() => null),
    api.get<InventoryActivityRow[]>('/v1/inventory/reports/activity?limit=6').catch(() => null),
    api.get<ValuationTimeseries>('/v1/inventory/reports/valuation-timeseries').catch(() => null),
  ]);

  const locationCount = locations
    ? ((locations.meta?.total as number | undefined) ?? locations.data.length)
    : null;
  const sourceCount = summary
    ? summary.sources.total
    : sources
      ? ((sources.meta?.total as number | undefined) ?? sources.data.length)
      : null;
  const pausedSources = summary
    ? summary.sources.paused + summary.sources.error
    : (sources?.data.filter((s) => s.status !== 'active').length ?? 0);
  const currency = summary?.valuation.currency ?? 'USD';

  // Inventory value over time — daily snapshots (+ live-overlaid today). Live once
  // ≥2 days have been captured (a single point isn't a trend); else badged sample.
  const valuePoints =
    valueSeries && valueSeries.points.length > 0
      ? valueSeries.points.map((p) => ({ label: shortDay(p.bucket), value: p.costCents }))
      : null;
  const valueChart = liveOr(valuePoints, [...SAMPLE_VALUE_14D], { min: 2 });

  // Per-location units — live from the summary, else the badged sample.
  const hasLocations = !!(summary && summary.byLocation.length > 0);
  const byLocation = hasLocations
    ? summary.byLocation.map((l, i) => ({
        label: l.name,
        value: l.onHand,
        color: LOCATION_COLORS[i % LOCATION_COLORS.length],
      }))
    : SAMPLE_BY_LOCATION.map((s) => ({ ...s }));

  const hasLowOut = !!(summary && summary.lowOrOut.length > 0);
  const hasActivity = !!(activity && activity.length > 0);

  return (
    <Container size="xl">
      <Stack gap={6} className="py-8">
        <PageHeader
          icon={<Boxes className="h-5 w-5" />}
          title="Inventory"
          description="Stock & locations — across every location."
          actions={
            <>
              <Button asChild variant="outline" leftIcon={<Warehouse className="h-4 w-4" />}>
                <Link href="/inventory/warehouses">Warehouses</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                leftIcon={<SlidersHorizontal className="h-4 w-4" />}
              >
                <Link href="/inventory/sources">Sources</Link>
              </Button>
              <Button asChild color="module" leftIcon={<Plus className="h-4 w-4" />}>
                <Link href="/inventory/receiving">Receive stock</Link>
              </Button>
            </>
          }
        />

        {/* KPI strip — live from the inventory reporting summary */}
        <Grid cols={1} mdCols={2} lgCols={4} gap={4}>
          <Stat
            icon={<Box className="h-4 w-4" />}
            label="SKUs tracked"
            value={summary ? fmtNumber(summary.stockStatus.skuCount) : '—'}
            hint="Variant × location rows"
          />
          <Stat
            icon={<Package className="h-4 w-4" />}
            label="Units in stock"
            value={summary ? fmtNumber(summary.valuation.totalUnits) : '—'}
            hint="On hand, all locations"
          />
          <Stat
            icon={<DollarSign className="h-4 w-4" />}
            label="Inventory value"
            value={summary ? fmtMoneyCents(summary.valuation.totalCostCents, currency) : '—'}
            hint="At cost"
          />
          <Stat
            icon={<MapPin className="h-4 w-4" />}
            label="Locations"
            value={fmtNumber(locationCount)}
            hint={
              sourceCount != null
                ? `${fmtNumber(sourceCount)} feed${sourceCount === 1 ? '' : 's'}${pausedSources ? ` · ${pausedSources} paused` : ''}`
                : 'Stocking locations'
            }
          />
        </Grid>

        {/* Needs attention — out/low live; reorder + POs sample */}
        <ActionQueue
          title="Needs attention"
          icon={<AlertTriangle className="h-4 w-4" />}
          meta={summary ? undefined : <SampleBadge />}
        >
          <ActionTile
            asChild
            icon={<AlertTriangle className="h-5 w-5" />}
            count={summary?.stockStatus.outOfStock ?? 2}
            label="Out of stock"
            tone="danger"
          >
            <Link href="/inventory/reorder" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Box className="h-5 w-5" />}
            count={summary?.stockStatus.lowStock ?? 5}
            label="Low stock"
            tone="warning"
          >
            <Link href="/inventory/reorder" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<SlidersHorizontal className="h-5 w-5" />}
            count={summary?.sources.error ?? 0}
            label="Feeds erroring"
            tone="danger"
          >
            <Link href="/inventory/sources" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Truck className="h-5 w-5" />}
            count={3}
            label="Incoming POs"
            tone="module"
          >
            <Link href="/inventory/purchase-orders" />
          </ActionTile>
        </ActionQueue>

        {/* Inventory value (chart sample, footer live) + by location */}
        <div className={TWO_COL}>
          <OverviewCard
            title="Inventory value"
            icon={<Warehouse className="h-4 w-4" />}
            description="At cost · last 14 days"
            right={valueChart.isSample ? <SampleBadge reason="no-data" /> : undefined}
          >
            <AreaChart
              data={valueChart.data}
              series={[{ key: 'value', label: 'Value', color: 'module' }]}
              xKey="label"
              height={210}
              valueFormat={{ kind: 'currency', currency }}
              ariaLabel="Inventory value at cost over time"
            />
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--color-border-default)] pt-3 text-sm">
              {[
                ['SKUs', summary ? fmtNumber(summary.stockStatus.skuCount) : '—'],
                ['Units', summary ? fmtNumber(summary.valuation.totalUnits) : '—'],
                ['Available', summary ? fmtNumber(summary.valuation.totalAvailable) : '—'],
                [
                  'Retail value',
                  summary ? fmtMoneyCents(summary.valuation.totalRetailCents, currency) : '—',
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-[var(--color-text-tertiary)]">{label}</div>
                  <div className="font-medium">{value}</div>
                </div>
              ))}
            </div>
          </OverviewCard>

          <OverviewCard
            title="By location"
            icon={<MapPin className="h-4 w-4" />}
            right={
              hasLocations ? (
                <CardLink href="/inventory/warehouses">All</CardLink>
              ) : (
                <SampleBadge reason="no-data" />
              )
            }
          >
            <DonutChart
              data={byLocation}
              valueFormat="number"
              centerValue={summary ? fmtNumber(summary.valuation.totalUnits) : '9,840'}
              centerLabel="units"
              ariaLabel="Units by location"
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MetricTile value={fmtNumber(locationCount)} label="Locations" />
              <MetricTile
                value={summary ? fmtNumber(summary.valuation.totalAllocated) : '—'}
                label="Allocated"
              />
            </div>
          </OverviewCard>
        </div>

        {/* Low & out of stock — live */}
        <OverviewCard
          title="Low & out of stock"
          icon={<AlertTriangle className="h-4 w-4" />}
          description={`Available at or below ${summary?.lowStockThreshold ?? 5} units · across all locations`}
          right={
            hasLowOut ? (
              <CardLink href="/inventory/reorder">Reorder</CardLink>
            ) : (
              <SampleBadge reason="no-data" />
            )
          }
        >
          {hasLowOut ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.lowOrOut.map((r) => (
                  <TableRow key={`${r.variantId}-${r.location}`}>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell className="text-[var(--color-text-tertiary)]">
                      {r.location}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNumber(r.onHand)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtNumber(r.available)}
                    </TableCell>
                    <TableCell>
                      {r.status === 'out' ? (
                        <Badge color="danger" variant="soft">
                          Out of stock
                        </Badge>
                      ) : (
                        <Badge color="warning" variant="soft">
                          Low
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-[var(--color-text-tertiary)]">
              Everything is well-stocked — no items at or below the low-stock threshold.
            </p>
          )}
        </OverviewCard>

        {/* Stock by location + incoming POs + recent activity */}
        <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
          <OverviewCard
            title="Stock by location"
            icon={<Warehouse className="h-4 w-4" />}
            right={
              hasLocations ? (
                <CardLink href="/inventory/warehouses">Manage</CardLink>
              ) : (
                <SampleBadge reason="no-data" />
              )
            }
          >
            <BarList
              items={byLocation.map((l) => ({ ...l }))}
              color="module"
              valueFormat="number"
            />
            <p className="mt-4 border-t border-[var(--color-border-default)] pt-3 text-xs text-[var(--color-text-tertiary)]">
              Total on hand ·{' '}
              <span className="font-medium text-[var(--color-text-secondary)]">
                {summary ? fmtNumber(summary.valuation.totalUnits) : '9,840'} units
              </span>{' '}
              across {fmtNumber(locationCount)} locations
            </p>
          </OverviewCard>

          <OverviewCard
            title="Incoming POs"
            icon={<Truck className="h-4 w-4" />}
            right={<SampleBadge />}
          >
            {SAMPLE_POS.map((po) => (
              <OverviewRow
                key={po.name}
                icon={<Package className="h-4 w-4" />}
                tone="module"
                title={po.name}
                hint={po.when}
                right={`${po.units} units`}
              />
            ))}
            <EntityCreateButton
              entityType="purchase-order"
              newHref="/inventory/purchase-orders/new"
              variant="outline"
              size="sm"
              className="mt-4 w-full"
            >
              Create purchase order
            </EntityCreateButton>
          </OverviewCard>

          <OverviewCard
            title="Recent stock changes"
            icon={<History className="h-4 w-4" />}
            right={hasActivity ? undefined : <SampleBadge reason="no-data" />}
          >
            {hasActivity ? (
              <Timeline>
                {activity.map((a, i) => (
                  <TimelineItem key={a.id} showConnector={i < activity.length - 1}>
                    <TimelineTitle>
                      {a.title} —{' '}
                      <span className="font-normal text-[var(--color-text-secondary)]">
                        {signed(a.delta)} · {REASON_LABELS[a.reason] ?? a.reason} at {a.location}
                      </span>
                    </TimelineTitle>
                    <TimelineTime>
                      {timeAgo(a.createdAt)}
                      {a.balanceAfter != null ? ` · ${fmtNumber(a.balanceAfter)} on hand` : ''}
                    </TimelineTime>
                  </TimelineItem>
                ))}
              </Timeline>
            ) : (
              <p className="py-8 text-center text-sm text-[var(--color-text-tertiary)]">
                No stock changes recorded yet.
              </p>
            )}
          </OverviewCard>
        </Grid>
      </Stack>
    </Container>
  );
}
