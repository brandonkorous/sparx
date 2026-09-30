'use client';

// What you hold and what it is worth: the three headline figures, stock health,
// and how the value is spread across your locations.
//
// Every money figure here is built on recorded costs, and cost is optional — so
// each one asks `costCoverage` before printing an amount. $0.00 over 372
// garments is not a valuation, it is an absence wearing a number's clothes —
// and a figure that covers only nine items in ten is short without saying so.

import { Card, Stat, StatDesc, StatTitle, StatValue, Stats, Text } from '@wizeworks/silicaui-react';
import { faLocationDot } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { formatCents, plural } from './data';
import {
  deadStockLevelCount,
  deadStockSplit,
  deadStockValueCents,
  turnoverHeadline,
  type AgingReport,
  type InventorySummary,
  type TurnoverReport,
  stillCaption,
} from './reports-data';
import { NUMBER, barWidthClass, costCoverage } from './reports-shared';
import { Figure, ReportCard } from './reports-card';

const FIGURE = 'text-2xl tabular-nums';

function worthDescription(
  held: string,
  retail: string,
  cover: ReturnType<typeof costCoverage>
): string {
  if (cover.none) return `${held}, ${retail}. What they cost you has not been recorded.`;
  if (cover.partial) {
    return `${held} · ${retail}. ${plural(cover.uncostedUnits, 'unit has', 'units have')} no cost recorded, so the figure above is short by whatever ${cover.uncostedUnits === 1 ? 'that one costs' : 'those cost'}.`;
  }
  return `${held} · ${retail}`;
}

function WorthStat({ summary }: { summary: InventorySummary }) {
  const { totalUnits, totalCostCents, totalRetailCents, currency } = summary.valuation;
  const cover = costCoverage(summary.valuation);
  const held = `${plural(totalUnits, 'unit', 'units')} on hand`;
  const retail = `worth ${formatCents(totalRetailCents, currency)} at your selling prices`;

  return (
    <Stat>
      <StatTitle>What your stock is worth</StatTitle>
      <StatValue className={FIGURE}>
        {cover.none ? 'No cost yet' : formatCents(totalCostCents, currency)}
      </StatValue>
      <StatDesc>{worthDescription(held, retail, cover)}</StatDesc>
    </Stat>
  );
}

function StillStat({
  summary,
  aging,
}: {
  summary: InventorySummary;
  aging: AgingReport | undefined;
}) {
  const { currency } = summary.valuation;
  const uncosted = costCoverage(summary.valuation).none;
  const value = aging ? deadStockValueCents(aging) : null;
  const levels = aging ? deadStockLevelCount(aging) : 0;

  const figure = () => {
    if (value === null) return '—';
    if (uncosted && levels > 0) return 'No cost yet';
    return formatCents(value, currency);
  };

  // When every costed unit is in the dead bands, this figure and "What your
  // stock is worth" beside it are the SAME number. Both were right and the pane
  // showed them as two unrelated figures that happened to match, which is the
  // shape a reader reads as the software being broken rather than as the finding
  // it actually is. MEASURED 2026-09-19, Juniper Row: never-sold $1,934.56,
  // everything that HAS sold $0.00, total $1,934.56. Say it. Issue 692 is the
  // same lesson with the subtraction the other way up.
  const allOfIt = value !== null && value > 0 && value === summary.valuation.totalCostCents;

  /** Lines that have had three months to sell and did not. The never-sold band
   *  is in the FIGURE, because that money is genuinely sitting still, and it is
   *  not what makes the figure alarming. */
  const { stale } = aging ? deadStockSplit(aging) : { stale: 0 };

  return (
    <Stat>
      <StatTitle>Money sitting still</StatTitle>
      {/* Amber is a CLAIM, and it was being made about stock this same pane
          then says is fine. The figure covers two bands: "not sold in over 3
          months", which is money gathering dust, and "never sold", which the
          dead-stock section below explicitly excludes — "which is not the same
          thing as dead. They have not had the time." A shop whose whole figure
          is never-sold got an alarm-colored number above a green box telling it
          nothing was wrong. Colour on the band that is actually a problem. */}
      <StatValue className={stale > 0 ? `text-warning ${FIGURE}` : FIGURE}>{figure()}</StatValue>
      <StatDesc>
        {aging === undefined
          ? 'Working it out…'
          : allOfIt
            ? `${stillCaption(aging)}. That is every bit of the stock value you hold.`
            : stillCaption(aging)}
      </StatDesc>
    </Stat>
  );
}

function PaceStat({ turnover }: { turnover: TurnoverReport | undefined }) {
  const turns = turnover ? turnoverHeadline(turnover) : null;
  return (
    <Stat>
      <StatTitle>How fast it sells</StatTitle>
      <StatValue className={FIGURE}>{turns ? turns.value : '—'}</StatValue>
      <StatDesc>{turns ? turns.meaning : 'Working it out…'}</StatDesc>
    </Stat>
  );
}

export function Headline({
  summary,
  aging,
  turnover,
}: {
  summary: InventorySummary;
  aging: AgingReport | undefined;
  turnover: TurnoverReport | undefined;
}) {
  return (
    <Card className="shrink-0">
      {/* Stacks to one column in a narrow docked pane, three across when the
          pane has room — @container, because the pane's width is its own. */}
      <Stats className="grid grid-cols-1 gap-2 px-2 py-1 @2xl:grid-cols-3">
        <WorthStat summary={summary} />
        <StillStat summary={summary} aging={aging} />
        <PaceStat turnover={turnover} />
      </Stats>
    </Card>
  );
}

export function HealthCard({ summary }: { summary: InventorySummary }) {
  const { healthy, lowStock, outOfStock, skuCount } = summary.stockStatus;

  return (
    <ReportCard
      title="How your stock is looking"
      blurb="Counted across every product and place: measured by what a shopper could actually buy."
    >
      <div className="grid grid-cols-3 gap-2">
        <Figure tone="success" value={NUMBER.format(healthy)} label="Healthy" />
        <Figure tone="warning" value={NUMBER.format(lowStock)} label="Running low" />
        <Figure tone="danger" value={NUMBER.format(outOfStock)} label="Sold out" />
      </div>
      <Text className="text-sm">
        {plural(skuCount, 'stocked line', 'stocked lines')} in total, each counted at the place it
        is kept.
      </Text>
    </ReportCard>
  );
}

function LocationRow({
  location,
  peak,
}: {
  location: InventorySummary['byLocation'][number];
  peak: number;
}) {
  return (
    <li className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Text className="flex min-w-0 items-center gap-1.5">
          <Icon glyph={faLocationDot} className="size-4 shrink-0" aria-hidden />
          <span className="truncate font-medium">{location.name}</span>
        </Text>
        <Text className="text-sm tabular-nums">
          {plural(location.onHand, 'unit', 'units')} · {plural(location.skuCount, 'line', 'lines')}
        </Text>
      </div>
      {/* A bar, not a number to divide in your head — the shape shows at a
          glance which place holds the most. */}
      <div className="bg-base-200 h-2 w-full overflow-hidden rounded-full">
        <div className={`bg-module h-full rounded-full ${barWidthClass(location.onHand / peak)}`} />
      </div>
    </li>
  );
}

export function LocationsCard({ summary }: { summary: InventorySummary }) {
  const rows = [...summary.byLocation].sort((a, b) => b.onHand - a.onHand);
  const peak = Math.max(1, ...rows.map((r) => r.onHand));

  return (
    <ReportCard
      title="Where your stock is kept"
      blurb="How your units are spread across your locations."
    >
      <ul className="flex flex-col gap-3">
        {rows.map((location) => (
          <LocationRow key={location.warehouseId} location={location} peak={peak} />
        ))}
      </ul>
    </ReportCard>
  );
}
