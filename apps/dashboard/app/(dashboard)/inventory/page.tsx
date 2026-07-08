import Link from 'next/link';
import {
  AlertTriangle,
  Box,
  Boxes,
  CheckCircle2,
  DollarSign,
  History,
  MapPin,
  Package,
  Plus,
  SlidersHorizontal,
  Warehouse,
} from 'lucide-react';

import { requireSession } from '@sparx/auth';
import { Badge, Button, EmptyState, Table } from 'silicaui-react';
import {
  ActionQueue,
  ActionTile,
  AreaChart,
  BarList,
  DonutChart,
  PageHeader,
  Stat,
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
  fmtMoneyCents,
  fmtNumber,
} from '../_components/overview-bits';

// Inventory overview — the stock-keeper's glance: what's in stock, what's low,
// what it's worth, and what needs reordering. Inventory's module color is Amber
// — which is ALSO the semantic warning hue — so amber drives the module chrome
// while OUT-OF-STOCK stays unmistakably red (danger) and "low" reads as a
// warning badge. Valuation, stock-status counts, the low/out table, per-location
// quantities, the recent-change feed, and the value-over-time chart are wired
// LIVE to /v1/inventory/reports/* (fail-soft to "—" or a compact empty state).
// The value chart reads daily valuation snapshots
// (rollup_inventory_daily_valuation) + a live-overlay of today, so it builds
// forward from first capture. The inventory layout wraps this in
// <ModuleProvider module="inventory">.

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

  // Inventory value over time — daily snapshots (+ live-overlaid today). A trend
  // needs ≥2 captured days; a single point isn't a chart.
  const valuePoints =
    valueSeries && valueSeries.points.length >= 2
      ? valueSeries.points.map((p) => ({ label: shortDay(p.bucket), value: p.costCents }))
      : [];

  // Per-location units — live from the summary.
  const hasLocations = !!(summary && summary.byLocation.length > 0);
  const byLocation = hasLocations
    ? summary.byLocation.map((l, i) => ({
        label: l.name,
        value: l.onHand,
        color: LOCATION_COLORS[i % LOCATION_COLORS.length],
      }))
    : [];

  const hasLowOut = !!(summary && summary.lowOrOut.length > 0);
  const hasActivity = !!(activity && activity.length > 0);

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-8">
        <PageHeader
          icon={<Boxes className="h-5 w-5" />}
          title="Inventory"
          description="Stock & locations — across every location."
          actions={
            <>
              <Button
                variant="outline"
                iconStart={<Warehouse className="h-4 w-4" />}
                render={<Link href="/inventory/warehouses" />}
              >
                Warehouses
              </Button>
              <Button
                variant="outline"
                iconStart={<SlidersHorizontal className="h-4 w-4" />}
                render={<Link href="/inventory/sources" />}
              >
                Sources
              </Button>
              <Button
                color="module"
                iconStart={<Plus className="h-4 w-4" />}
                render={<Link href="/inventory/receiving" />}
              >
                Receive stock
              </Button>
            </>
          }
        />

        {/* KPI strip — live from the inventory reporting summary */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
        </div>

        {/* Needs attention — all live from the reporting summary */}
        {summary && (
          <ActionQueue
            title="Needs attention"
            icon={<AlertTriangle className="h-4 w-4" />}
            columns={3}
          >
            <ActionTile
              asChild
              icon={<AlertTriangle className="h-5 w-5" />}
              count={summary.stockStatus.outOfStock}
              label="Out of stock"
              tone="danger"
            >
              <Link href="/inventory/reorder" />
            </ActionTile>
            <ActionTile
              asChild
              icon={<Box className="h-5 w-5" />}
              count={summary.stockStatus.lowStock}
              label="Low stock"
              tone="warning"
            >
              <Link href="/inventory/reorder" />
            </ActionTile>
            <ActionTile
              asChild
              icon={<SlidersHorizontal className="h-5 w-5" />}
              count={summary.sources.error}
              label="Feeds erroring"
              tone="danger"
            >
              <Link href="/inventory/sources" />
            </ActionTile>
          </ActionQueue>
        )}

        {/* Inventory value (the page's primary tinted card) + by location */}
        <div className={TWO_COL}>
          <OverviewCard
            title="Inventory value"
            icon={<Warehouse className="h-4 w-4" />}
            description="At cost · daily snapshots"
          >
            {valuePoints.length ? (
              <>
                <AreaChart
                  data={valuePoints}
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
              </>
            ) : (
              <EmptyState
                icon={<Warehouse className="h-5 w-5" />}
                title="No valuation history yet"
                description="Inventory value plots here once a couple of daily snapshots are captured."
              />
            )}
          </OverviewCard>

          <OverviewCard
            title="By location"
            icon={<MapPin className="h-4 w-4" />}
            right={hasLocations ? <CardLink href="/inventory/warehouses">All</CardLink> : undefined}
            plain
          >
            {hasLocations ? (
              <>
                <DonutChart
                  data={byLocation}
                  valueFormat="number"
                  centerValue={summary ? fmtNumber(summary.valuation.totalUnits) : '—'}
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
              </>
            ) : (
              <EmptyState
                icon={<MapPin className="h-5 w-5" />}
                title="No location stock yet"
                description="Units split by location appear once stock is tracked."
              />
            )}
          </OverviewCard>
        </div>

        {/* Low & out of stock — live */}
        <OverviewCard
          title="Low & out of stock"
          icon={<AlertTriangle className="h-4 w-4" />}
          description={`Available at or below ${summary?.lowStockThreshold ?? 5} units · across all locations`}
          right={hasLowOut ? <CardLink href="/inventory/reorder">Reorder</CardLink> : undefined}
          plain
        >
          {hasLowOut ? (
            <Table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Location</th>
                  <th className="text-right">On hand</th>
                  <th className="text-right">Available</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.lowOrOut.map((r) => (
                  <tr key={`${r.variantId}-${r.location}`}>
                    <td className="font-medium">{r.title}</td>
                    <td className="text-[var(--color-text-tertiary)]">{r.location}</td>
                    <td className="text-right tabular-nums">{fmtNumber(r.onHand)}</td>
                    <td className="text-right tabular-nums">{fmtNumber(r.available)}</td>
                    <td>
                      {r.status === 'out' ? (
                        <Badge color="danger" variant="soft">
                          Out of stock
                        </Badge>
                      ) : (
                        <Badge color="warning" variant="soft">
                          Low
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="Everything is well-stocked"
              description="No items at or below the low-stock threshold."
            />
          )}
        </OverviewCard>

        {/* Stock by location + recent activity */}
        <div className={TWO_COL}>
          <OverviewCard
            title="Stock by location"
            icon={<Warehouse className="h-4 w-4" />}
            right={
              hasLocations ? <CardLink href="/inventory/warehouses">Manage</CardLink> : undefined
            }
            plain
          >
            {hasLocations ? (
              <>
                <BarList
                  items={byLocation.map((l) => ({ ...l }))}
                  color="module"
                  valueFormat="number"
                />
                <p className="mt-4 border-t border-[var(--color-border-default)] pt-3 text-xs text-[var(--color-text-tertiary)]">
                  Total on hand ·{' '}
                  <span className="font-medium text-[var(--color-text-secondary)]">
                    {summary ? fmtNumber(summary.valuation.totalUnits) : '—'} units
                  </span>{' '}
                  across {fmtNumber(locationCount)} locations
                </p>
              </>
            ) : (
              <EmptyState
                icon={<Warehouse className="h-5 w-5" />}
                title="No stock by location yet"
                description="Stock distribution across locations appears here once tracked."
              />
            )}
          </OverviewCard>

          <OverviewCard title="Recent stock changes" icon={<History className="h-4 w-4" />} plain>
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
              <EmptyState
                icon={<History className="h-5 w-5" />}
                title="No stock changes yet"
                description="Stock movements show up here as they happen."
              />
            )}
          </OverviewCard>
        </div>
      </div>
    </div>
  );
}
