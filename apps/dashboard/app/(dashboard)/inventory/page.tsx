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
import {
  CardLink,
  MetricTile,
  OverviewCard,
  OverviewRow,
  SampleBadge,
  fmtNumber,
} from '../_components/overview-bits';

// Inventory overview — the stock-keeper's glance: what's in stock, what's low,
// what it's worth, and what needs reordering. Inventory's module color is Amber
// — which is ALSO the semantic warning hue — so amber drives the module chrome
// while OUT-OF-STOCK stays unmistakably red (danger) and "low" reads as a
// warning badge. Location/source COUNTS are wired live to /v1/inventory/* (fail
// soft to "—"); the operational figures without a reporting endpoint yet (units,
// value, the low/out table, POs, activity) are representative data behind a
// <SampleBadge>, the dashboard's sanctioned interim. The inventory layout wraps
// this in <ModuleProvider module="inventory">, so the page never re-wraps.

export const dynamic = 'force-dynamic';

const TWO_COL = 'grid grid-cols-1 gap-4 lg:grid-cols-[1.9fr_1fr]';

interface InventoryLocation {
  id: string;
  name: string;
}
interface InventorySource {
  id: string;
  name: string;
  status: string;
  lastSyncAt: string | null;
}

// ── Sample data (illustrative until inventory reporting endpoints land) ──
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

const SAMPLE_LOW_OUT = [
  { product: 'Switchback Mug', location: 'Main warehouse', onHand: 0, reorder: 25, out: true },
  {
    product: 'Cold Brew Concentrate',
    location: 'Main warehouse',
    onHand: 3,
    reorder: 30,
    out: false,
  },
  {
    product: 'Single-Origin Ethiopia',
    location: 'Main warehouse',
    onHand: 8,
    reorder: 20,
    out: false,
  },
  {
    product: 'Trailhead Blend · 12oz',
    location: 'Retail store',
    onHand: 6,
    reorder: 15,
    out: false,
  },
  { product: 'Gift box — Holiday', location: '3PL', onHand: 0, reorder: 10, out: true },
  { product: 'AeroPress filters', location: 'Main warehouse', onHand: 14, reorder: 40, out: false },
] as const;

const SAMPLE_BY_LOCATION: { label: string; value: number; color?: string }[] = [
  { label: 'Main', value: 5710 },
  { label: 'Retail', value: 2360, color: '#fbbf24' },
  { label: '3PL', value: 1770, color: '#fcd34d' },
];

const SAMPLE_POS = [
  { name: 'PO-218 · Cascade', when: 'Arrives Jun 18', units: '1,200' },
  { name: 'PO-217 · Andes', when: 'Arrives Jun 21', units: '800' },
  { name: 'PO-215 · PourCraft', when: 'Arrives Jun 24', units: '60' },
] as const;

const SAMPLE_ACTIVITY = [
  { title: 'Received 1,200 units — Cascade', when: '2 hours ago' },
  { title: 'Adjusted −12 (damage) — Switchback Mug', when: 'Yesterday · Sam Ortiz' },
  { title: 'Transfer 200 units → Retail store', when: '2 days ago' },
  { title: 'Cycle count completed — Main warehouse', when: '4 days ago' },
] as const;

export default async function InventoryPage() {
  await requireSession();

  const [locations, sources] = await Promise.all([
    api.getPaged<InventoryLocation[]>('/v1/inventory/locations?take=20').catch(() => null),
    api.getPaged<InventorySource[]>('/v1/inventory/sources?take=20').catch(() => null),
  ]);
  const locationCount = locations
    ? ((locations.meta?.total as number | undefined) ?? locations.data.length)
    : null;
  const sourceCount = sources
    ? ((sources.meta?.total as number | undefined) ?? sources.data.length)
    : null;
  const pausedSources = sources?.data.filter((s) => s.status !== 'active').length ?? 0;

  // Use live location names for the "by location" breakdown when present, mapping
  // them onto the representative proportions; fall back to the sample labels.
  const byLocation = locations?.data.length
    ? locations.data.slice(0, 3).map((loc, i) => ({
        label: loc.name,
        value: SAMPLE_BY_LOCATION[i]?.value ?? 0,
        color: SAMPLE_BY_LOCATION[i]?.color,
      }))
    : SAMPLE_BY_LOCATION.map((s) => ({ ...s }));

  return (
    <Container size="xl">
      <Stack gap={6} className="py-8">
        <PageHeader
          icon={<Boxes className="h-5 w-5" />}
          title="Inventory"
          description="Stock & locations — across every location."
          actions={
            <>
              <Button asChild variant="outline" leftIcon={<MapPin className="h-4 w-4" />}>
                <Link href="/inventory/locations">Locations</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                leftIcon={<SlidersHorizontal className="h-4 w-4" />}
              >
                <Link href="/inventory/sources">Sources</Link>
              </Button>
              <Button asChild color="module" leftIcon={<Plus className="h-4 w-4" />}>
                <Link href="/inventory/sources">Receive stock</Link>
              </Button>
            </>
          }
        />

        {/* KPI strip — counts live, quantities/value sample */}
        <Grid cols={1} mdCols={2} lgCols={4} gap={4}>
          <Stat
            icon={<Box className="h-4 w-4" />}
            label="SKUs tracked"
            value="248"
            hint="Across the catalog"
          />
          <Stat
            icon={<Package className="h-4 w-4" />}
            label="Units in stock"
            value="9,840"
            hint="On hand, all locations"
          />
          <Stat
            icon={<DollarSign className="h-4 w-4" />}
            label="Inventory value"
            value="$128,400"
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

        {/* Needs attention */}
        <ActionQueue
          title="Needs attention"
          icon={<AlertTriangle className="h-4 w-4" />}
          meta={<SampleBadge />}
        >
          <ActionTile
            asChild
            icon={<AlertTriangle className="h-5 w-5" />}
            count={2}
            label="Out of stock"
            tone="danger"
          >
            <Link href="/inventory/sources" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Box className="h-5 w-5" />}
            count={5}
            label="Low stock"
            tone="warning"
          >
            <Link href="/inventory/sources" />
          </ActionTile>
          <ActionTile
            asChild
            icon={<Package className="h-5 w-5" />}
            count={4}
            label="Reorder suggested"
            tone="module"
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
            <Link href="/inventory/sources" />
          </ActionTile>
        </ActionQueue>

        {/* Inventory value + by location */}
        <div className={TWO_COL}>
          <OverviewCard
            title="Inventory value"
            icon={<Warehouse className="h-4 w-4" />}
            description="At cost · last 14 days"
            right={<SampleBadge />}
          >
            <AreaChart
              data={[...SAMPLE_VALUE_14D]}
              series={[{ key: 'value', label: 'Value', color: 'module' }]}
              xKey="label"
              height={210}
              valueFormat={{ kind: 'currency', currency: 'USD' }}
              ariaLabel="Inventory value at cost, last 14 days"
            />
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--color-border-default)] pt-3 text-sm">
              {[
                ['SKUs', '248'],
                ['Units', '9,840'],
                ['Turnover', '4.2×'],
                ['Value', '$128,400'],
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
            right={<CardLink href="/inventory/locations">All</CardLink>}
          >
            <DonutChart
              data={byLocation.map((l, i) => ({
                label: l.label,
                value: l.value,
                color: i === 0 ? 'module' : l.color,
              }))}
              valueFormat="number"
              centerValue="9,840"
              centerLabel="units"
              ariaLabel="Units by location"
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MetricTile value={fmtNumber(locationCount)} label="Locations" />
              <MetricTile value="96%" label="Stock accuracy" />
            </div>
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>
        </div>

        {/* Low & out of stock */}
        <OverviewCard
          title="Low & out of stock"
          icon={<AlertTriangle className="h-4 w-4" />}
          description="Below reorder point · across all locations"
          right={<CardLink href="/inventory/sources">All stock</CardLink>}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Reorder point</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_LOW_OUT.map((r) => (
                <TableRow key={r.product}>
                  <TableCell className="font-medium">{r.product}</TableCell>
                  <TableCell className="text-[var(--color-text-tertiary)]">{r.location}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.onHand}</TableCell>
                  <TableCell className="text-right text-[var(--color-text-tertiary)] tabular-nums">
                    {r.reorder}
                  </TableCell>
                  <TableCell>
                    {r.out ? (
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
          <div className="mt-3">
            <SampleBadge />
          </div>
        </OverviewCard>

        {/* Stock by location + incoming POs + recent activity */}
        <Grid cols={1} mdCols={2} lgCols={3} gap={4}>
          <OverviewCard
            title="Stock by location"
            icon={<Warehouse className="h-4 w-4" />}
            right={<CardLink href="/inventory/locations">Manage</CardLink>}
          >
            <BarList
              items={byLocation.map((l) => ({ ...l }))}
              color="module"
              valueFormat="number"
            />
            <p className="mt-4 border-t border-[var(--color-border-default)] pt-3 text-xs text-[var(--color-text-tertiary)]">
              Total on hand ·{' '}
              <span className="font-medium text-[var(--color-text-secondary)]">9,840 units</span>{' '}
              across {fmtNumber(locationCount)} locations
            </p>
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>

          <OverviewCard
            title="Incoming POs"
            icon={<Truck className="h-4 w-4" />}
            right={<CardLink href="/inventory/sources">All POs</CardLink>}
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
            <Button asChild variant="outline" size="sm" className="mt-4 w-full">
              <Link href="/inventory/sources">Create purchase order</Link>
            </Button>
            <div className="mt-3">
              <SampleBadge />
            </div>
          </OverviewCard>

          <OverviewCard title="Recent activity" icon={<History className="h-4 w-4" />}>
            <Timeline>
              {SAMPLE_ACTIVITY.map((a, i) => (
                <TimelineItem key={a.title} showConnector={i < SAMPLE_ACTIVITY.length - 1}>
                  <TimelineTitle>{a.title}</TimelineTitle>
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
