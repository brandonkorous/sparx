'use client';

// REPORTS — what your stock is worth, what is sitting still, and how fast it moves.
//
// ── A reporting surface, not a list ──────────────────────────────────────
//
// There is nothing to create, open or narrow to a row here. It answers three
// questions an owner actually asks about the money tied up in stock, each with
// the headline figure large and the detail underneath: what it is worth, what
// is gathering dust, and how fast it turns over. So it is stat cards over a
// couple of quiet tables in one capped, centred column — never a grid of rows.
//
// ── Every figure is worked out on the SERVER ─────────────────────────────
//
// Valuation, turnover and ageing are sums over the whole of your stock and the
// movement ledger. The selling period and the location are server params, so
// the answer is always about ALL of your stock — not the rows that happened to
// load. Filtering a report in the browser would answer a question about a
// handful of items and present it as the whole picture.
//
// ── No charting library ──────────────────────────────────────────────────
//
// The one visual — a share bar beside each ageing band and each location — is
// built from a fixed set of Tailwind width classes, not an inline width and not
// a chart dependency. One series, no axes: pulling in a library to draw a few
// rectangles would be the tail wagging the dog.

import { useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Card,
  EmptyState,
  Heading,
  NativeSelect,
  Stat,
  StatDesc,
  StatTitle,
  StatValue,
  Stats,
  Table,
  Text,
  Timestamp,
} from '@wizeworks/silicaui-react';
import { BarChart3, Boxes, Clock, MapPin } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents, plural, useStockLocations } from './data';
import {
  agingBucketLabel,
  agingBucketTone,
  deadStockLevelCount,
  deadStockValueCents,
  rangeForDays,
  RANGE_PRESETS,
  turnoverHeadline,
  useAgingReport,
  useInventorySummary,
  useTurnoverReport,
  type AgingReport,
  type DeadStockItem,
  type InventorySummary,
  type TurnoverReport,
} from './reports-data';

const COLUMN = 'mx-auto flex w-full max-w-5xl flex-col gap-4';
const NUMBER = new Intl.NumberFormat();

/** Same modifier contract as every list — a dead-stock line opens that item's
 *  stock, alongside on shift, in a new window on alt. */
function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/**
 * A proportion as one of a fixed set of width classes.
 *
 * Quantised to 5% steps so every width is a LITERAL Tailwind class the compiler
 * can see — an inline `style={{ width }}` is banned, and on a bar this short a
 * 5% step is a couple of pixels, below the threshold of noticing.
 */
const BAR_WIDTH = [
  'w-px',
  'w-[5%]',
  'w-[10%]',
  'w-[15%]',
  'w-[20%]',
  'w-[25%]',
  'w-[30%]',
  'w-[35%]',
  'w-[40%]',
  'w-[45%]',
  'w-[50%]',
  'w-[55%]',
  'w-[60%]',
  'w-[65%]',
  'w-[70%]',
  'w-[75%]',
  'w-[80%]',
  'w-[85%]',
  'w-[90%]',
  'w-[95%]',
  'w-full',
];

function barWidthClass(fraction: number): string {
  if (!Number.isFinite(fraction) || fraction <= 0) return BAR_WIDTH[0]!;
  const step = Math.round(Math.min(1, fraction) * 20);
  return BAR_WIDTH[step] ?? BAR_WIDTH[BAR_WIDTH.length - 1]!;
}

/* ── Headline figures ────────────────────────────────────────────────────── */

function Headline({
  summary,
  aging,
  turnover,
}: {
  summary: InventorySummary;
  aging: AgingReport | undefined;
  turnover: TurnoverReport | undefined;
}) {
  const { valuation } = summary;
  const currency = valuation.currency;
  const deadValue = aging ? deadStockValueCents(aging) : null;
  const deadLevels = aging ? deadStockLevelCount(aging) : 0;
  const turns = turnover ? turnoverHeadline(turnover) : null;

  return (
    <Card className="shrink-0">
      {/* Stacks to one column in a narrow docked pane, three across when the
          pane has room — @container, because the pane's width is its own. */}
      <Stats className="grid grid-cols-1 gap-2 px-2 py-1 @2xl:grid-cols-3">
        <Stat>
          <StatTitle>What your stock is worth</StatTitle>
          <StatValue className="text-2xl tabular-nums">
            {formatCents(valuation.totalCostCents, currency)}
          </StatValue>
          <StatDesc>
            {plural(valuation.totalUnits, 'unit', 'units')} on hand · worth{' '}
            {formatCents(valuation.totalRetailCents, currency)} at your selling prices
          </StatDesc>
        </Stat>

        <Stat>
          <StatTitle>Money sitting still</StatTitle>
          <StatValue
            className={
              deadValue && deadValue > 0
                ? 'text-warning text-2xl tabular-nums'
                : 'text-2xl tabular-nums'
            }
          >
            {deadValue === null ? '—' : formatCents(deadValue, currency)}
          </StatValue>
          <StatDesc>
            {deadValue === null
              ? 'Working it out…'
              : deadLevels === 0
                ? 'Nothing has gone unsold for three months'
                : `${plural(deadLevels, 'line', 'lines')} not sold in over 3 months`}
          </StatDesc>
        </Stat>

        <Stat>
          <StatTitle>How fast it sells</StatTitle>
          <StatValue className="text-2xl tabular-nums">{turns ? turns.value : '—'}</StatValue>
          <StatDesc>{turns ? turns.meaning : 'Working it out…'}</StatDesc>
        </Stat>
      </Stats>
    </Card>
  );
}

/* ── Stock health ────────────────────────────────────────────────────────── */

function HealthCard({ summary }: { summary: InventorySummary }) {
  const { healthy, lowStock, outOfStock, skuCount } = summary.stockStatus;

  return (
    <section className="card bg-base-100 flex flex-col gap-3 p-4">
      <div className="border-base-300 flex flex-col gap-0.5 border-b pb-2">
        <Heading level={2} className="text-lg font-semibold">
          How your stock is looking
        </Heading>
        <Text className="text-sm">
          Counted across every product and place — measured by what a shopper could actually buy.
        </Text>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col">
          <Text className="text-success text-2xl font-semibold tabular-nums">
            {NUMBER.format(healthy)}
          </Text>
          <Text className="text-sm">Healthy</Text>
        </div>
        <div className="flex flex-col">
          <Text className="text-warning text-2xl font-semibold tabular-nums">
            {NUMBER.format(lowStock)}
          </Text>
          <Text className="text-sm">Running low</Text>
        </div>
        <div className="flex flex-col">
          <Text className="text-danger text-2xl font-semibold tabular-nums">
            {NUMBER.format(outOfStock)}
          </Text>
          <Text className="text-sm">Sold out</Text>
        </div>
      </div>
      <Text className="text-sm">
        {plural(skuCount, 'stocked line', 'stocked lines')} in total, each counted at the place it
        is kept.
      </Text>
    </section>
  );
}

/* ── Where the value is kept ─────────────────────────────────────────────── */

function LocationsCard({ summary }: { summary: InventorySummary }) {
  const rows = [...summary.byLocation].sort((a, b) => b.onHand - a.onHand);
  const peak = Math.max(1, ...rows.map((r) => r.onHand));

  return (
    <section className="card bg-base-100 flex flex-col gap-3 p-4">
      <div className="border-base-300 flex flex-col gap-0.5 border-b pb-2">
        <Heading level={2} className="text-lg font-semibold">
          Where your stock is kept
        </Heading>
        <Text className="text-sm">How your units are spread across your locations.</Text>
      </div>
      <ul className="flex flex-col gap-3">
        {rows.map((location) => (
          <li key={location.warehouseId} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Text className="flex min-w-0 items-center gap-1.5">
                <MapPin className="size-4 shrink-0" aria-hidden />
                <span className="truncate font-medium">{location.name}</span>
              </Text>
              <Text className="text-sm tabular-nums">
                {plural(location.onHand, 'unit', 'units')} ·{' '}
                {plural(location.skuCount, 'line', 'lines')}
              </Text>
            </div>
            {/* A bar, not a number to divide in your head — the shape shows at a
                glance which place holds the most. */}
            <div className="bg-base-200 h-2 w-full overflow-hidden rounded-full">
              <div
                className={`bg-module h-full rounded-full ${barWidthClass(location.onHand / peak)}`}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── How long stock has sat unsold ───────────────────────────────────────── */

function AgeingCard({
  report,
  currency,
  locationName,
}: {
  report: AgingReport;
  currency: string;
  locationName: string | null;
}) {
  const withStock = report.buckets.filter((b) => b.levels > 0);
  const totalValue = report.buckets.reduce((sum, b) => sum + b.costCents, 0);

  return (
    <section className="card bg-base-100 flex flex-col gap-3 p-4">
      <div className="border-base-300 flex flex-col gap-0.5 border-b pb-2">
        <Heading level={2} className="text-lg font-semibold">
          How long your stock has sat unsold
        </Heading>
        <Text className="text-sm">
          The value of what you hold, grouped by how long since it last sold
          {locationName ? ` at ${locationName}` : ''}. The lower bands are money working the
          hardest.
        </Text>
      </div>

      {withStock.length === 0 ? (
        <Text className="text-sm">
          There is no stock on hand to age{locationName ? ` at ${locationName}` : ''} just yet.
        </Text>
      ) : (
        <Table size="sm">
          <thead>
            <tr>
              <th>How recently it sold</th>
              <th className="text-right whitespace-nowrap">Value held</th>
              <th className="hidden text-right @lg:table-cell">Units</th>
              <th className="hidden @xl:table-cell">Share</th>
            </tr>
          </thead>
          <tbody>
            {withStock.map((bucket) => (
              <tr key={bucket.bucket}>
                <td>
                  <Badge color={agingBucketTone(bucket.bucket)} variant="soft" size="sm">
                    {agingBucketLabel(bucket.bucket)}
                  </Badge>
                </td>
                <td className="text-right font-medium whitespace-nowrap tabular-nums">
                  {formatCents(bucket.costCents, currency)}
                </td>
                <td className="hidden text-right tabular-nums @lg:table-cell">
                  {NUMBER.format(bucket.units)}
                </td>
                <td className="hidden @xl:table-cell">
                  <div className="bg-base-200 h-2 w-full max-w-40 overflow-hidden rounded-full">
                    <div
                      className={`bg-module h-full rounded-full ${barWidthClass(
                        totalValue > 0 ? bucket.costCents / totalValue : 0
                      )}`}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </section>
  );
}

/* ── The priciest items gathering dust ───────────────────────────────────── */

function DeadStockCard({
  items,
  currency,
  onOpen,
}: {
  items: DeadStockItem[];
  currency: string;
  onOpen: (item: DeadStockItem, event: { shiftKey: boolean; altKey: boolean }) => void;
}) {
  return (
    <section className="card bg-base-100 flex flex-col gap-3 p-4">
      <div className="border-base-300 flex flex-col gap-0.5 border-b pb-2">
        <Heading level={2} className="text-lg font-semibold">
          Worth freeing up first
        </Heading>
        <Text className="text-sm">
          The items with the most money tied up that have not sold in months. Discounting, moving or
          returning these is where cash comes back quickest.
        </Text>
      </div>
      <Table size="sm" hover>
        <thead>
          <tr>
            <th>Item</th>
            <th className="hidden @lg:table-cell">Where</th>
            <th className="text-right whitespace-nowrap">Value</th>
            <th className="hidden text-right whitespace-nowrap @xl:table-cell">Last sold</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={`${item.variantId}:${item.warehouseId}`}
              className="cursor-pointer"
              tabIndex={0}
              role="button"
              onClick={(event) => {
                onOpen(item, event);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                onOpen(item, event);
              }}
            >
              <td className="w-full max-w-0">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{item.title ?? 'Untitled product'}</span>
                  <span className="truncate font-mono text-sm">{item.sku ?? 'No code'}</span>
                </span>
              </td>
              <td className="hidden max-w-40 truncate @lg:table-cell">{item.warehouseCode}</td>
              <td className="text-right font-medium whitespace-nowrap tabular-nums">
                {formatCents(item.costCents, currency)}
              </td>
              <td className="hidden text-right whitespace-nowrap @xl:table-cell">
                {item.lastSaleAt ? (
                  <Timestamp value={item.lastSaleAt} format="relative" />
                ) : (
                  'Never'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}

/* ── Turnover detail ─────────────────────────────────────────────────────── */

function TurnoverCard({ report, currency }: { report: TurnoverReport; currency: string }) {
  return (
    <section className="card bg-base-100 flex flex-col gap-3 p-4">
      <div className="border-base-300 flex flex-col gap-0.5 border-b pb-2">
        <Heading level={2} className="flex items-center gap-2 text-lg font-semibold">
          <Clock className="size-4" aria-hidden />
          Selling pace, in detail
        </Heading>
        <Text className="text-sm">
          Measured over the last {plural(report.periodDays, 'day', 'days')}.
        </Text>
      </div>
      <div className="grid grid-cols-1 gap-2 @md:grid-cols-3">
        <div className="flex flex-col">
          <Text className="text-2xl font-semibold tabular-nums">
            {NUMBER.format(report.unitsSold)}
          </Text>
          <Text className="text-sm">Units sold</Text>
        </div>
        <div className="flex flex-col">
          <Text className="text-2xl font-semibold tabular-nums">
            {formatCents(report.cogsCents, currency)}
          </Text>
          <Text className="text-sm">What those goods cost you</Text>
        </div>
        <div className="flex flex-col">
          <Text className="text-2xl font-semibold tabular-nums">
            {formatCents(report.avgInventoryValueCents, currency)}
          </Text>
          <Text className="text-sm">Average value in stock</Text>
        </div>
      </div>
    </section>
  );
}

/* ── The surface ─────────────────────────────────────────────────────────── */

export function ReportsSurface({ ctx }: { ctx: SurfaceContext }) {
  const [rangeDays, setRangeDays] = useState(30);
  const [locationId, setLocationId] = useState('');

  // Memoised on the preset alone: rangeForDays reads the clock, so recomputing
  // it every render would mint a fresh query key each time and refetch forever.
  const range = useMemo(() => rangeForDays(rangeDays), [rangeDays]);

  const summary = useInventorySummary();
  const turnover = useTurnoverReport(range);
  const aging = useAgingReport({ warehouseId: locationId, deadStockDays: 90 });

  const locations = useStockLocations();
  const activeLocations = (locations.data?.items ?? []).filter((l) => l.isActive);
  const locationName = activeLocations.find((l) => l.id === locationId)?.name ?? null;

  const openItem = (item: DeadStockItem, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('inventory.stock.item', { variantId: item.variantId }, { target: targetFor(event) });
  };

  const refreshAll = () => {
    void summary.refetch();
    void turnover.refetch();
    void aging.refetch();
  };

  const body = () => {
    // A failed valuation is a failed report — it is the spine every other figure
    // hangs off, so its failure REPLACES the surface rather than leaving empty
    // cards implying you own nothing.
    if (summary.isError) {
      return (
        <EmptyState
          icon={<BarChart3 className="size-6" aria-hidden />}
          title="Could not load your reports"
          description="This is a problem reaching the server. Your stock and its history are unaffected — the figures just could not be worked out just now."
        />
      );
    }

    if (summary.isPending) {
      return (
        <p className="p-4 text-sm" role="status">
          Working out your figures…
        </p>
      );
    }

    const data = summary.data;
    // `isPending` is a boolean, not the query's discriminant, so TypeScript does
    // not narrow `data` to defined from the guard above — this makes it explicit.
    if (!data) return null;
    const nothingCounted = data.stockStatus.skuCount === 0 && data.valuation.totalUnits === 0;
    if (nothingCounted) {
      return (
        <EmptyState
          icon={<Boxes className="size-6" aria-hidden />}
          title="Nothing to report on yet"
          description="These figures appear once you have stock counted somewhere. Open a product and use its Stock panel to record how many you have — value, ageing and selling pace all build from there."
        />
      );
    }

    const currency = data.valuation.currency;
    const deadStock = aging.data?.deadStock ?? [];

    return (
      <div className={COLUMN}>
        <div className="flex flex-col gap-1">
          <Heading level={1} className="text-2xl font-semibold">
            Stock reports
          </Heading>
          <Text>
            What your stock is worth, what is sitting still, and how fast it moves — the money side
            of what you hold.
          </Text>
        </div>

        <Headline summary={data} aging={aging.data} turnover={turnover.data} />

        <HealthCard summary={data} />

        {data.byLocation.length > 1 ? <LocationsCard summary={data} /> : null}

        {/* Ageing owns its own load/error state — the valuation above stays
            readable even if this one query is slow or fails. */}
        {aging.isError ? (
          <Alert color="warning" variant="soft">
            <AlertContent>
              <AlertTitle>Could not work out ageing just now</AlertTitle>
              <AlertDescription>
                The rest of your figures are fine. Refresh to try the ageing breakdown again.
              </AlertDescription>
            </AlertContent>
          </Alert>
        ) : aging.data ? (
          <>
            <AgeingCard report={aging.data} currency={currency} locationName={locationName} />
            {deadStock.length > 0 ? (
              <DeadStockCard items={deadStock} currency={currency} onOpen={openItem} />
            ) : (
              <Alert color="success" variant="soft">
                <AlertContent>
                  <AlertTitle>Nothing is gathering dust</AlertTitle>
                  <AlertDescription>
                    Everything you hold{locationName ? ` at ${locationName}` : ''} has sold recently
                    enough not to count as dead stock. That is money working, not sitting.
                  </AlertDescription>
                </AlertContent>
              </Alert>
            )}
          </>
        ) : (
          <p className="p-4 text-sm" role="status">
            Working out ageing…
          </p>
        )}

        {turnover.isError ? (
          <Alert color="warning" variant="soft">
            <AlertContent>
              <AlertTitle>Could not work out selling pace just now</AlertTitle>
              <AlertDescription>
                The rest of your figures are fine. Refresh to try again.
              </AlertDescription>
            </AlertContent>
          </Alert>
        ) : turnover.data ? (
          <TurnoverCard report={turnover.data} currency={currency} />
        ) : null}
      </div>
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar label="Report controls">
        {/* Sets the window for the selling-pace figures. Named for what it does,
            not "range". */}
        <NativeSelect
          size="sm"
          className="max-w-40 shrink"
          aria-label="Selling period for turnover"
          value={String(rangeDays)}
          onChange={(event) => {
            setRangeDays(Number(event.target.value));
          }}
        >
          {RANGE_PRESETS.map((preset) => (
            <option key={preset.days} value={preset.days}>
              {preset.label}
            </option>
          ))}
        </NativeSelect>

        {/* Narrows the ageing breakdown to one place — "which shop is holding
            money it isn't turning" is a real question. */}
        <NativeSelect
          size="sm"
          className="max-w-40 shrink"
          aria-label="Location for the ageing breakdown"
          value={locationId}
          onChange={(event) => {
            setLocationId(event.target.value);
          }}
        >
          <option value="">Every location</option>
          {activeLocations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </NativeSelect>

        {/* ALWAYS the last child of a toolbar. No primary action here, so it
            carries the ml-auto that pushes the right-hand group over. */}
        <RefreshButton
          className="ml-auto"
          isFetching={summary.isFetching || turnover.isFetching || aging.isFetching}
          updatedAt={summary.data ? summary.dataUpdatedAt : undefined}
          onRefresh={refreshAll}
        />
      </PaneToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">{body()}</div>
    </div>
  );
}
