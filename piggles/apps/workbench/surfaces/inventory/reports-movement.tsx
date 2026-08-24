'use client';

// The two halves of the same sum: how fast stock moved, and what the stock that
// moved had cost. Both follow the pane's period picker, so they are comparable
// rather than merely adjacent.

import { Text } from '@wizeworks/silicaui-react';
import { faClock, faCoins } from '@fortawesome/pro-solid-svg-icons';
import { formatCents, plural } from './data';
import type { TurnoverReport } from './reports-data';
import { cogsReasonLabel, useCogsReport, type CogsReport } from './costing-data';
import { NUMBER, barWidthClass } from './reports-shared';
import { Figure, ReportCard } from './reports-card';
import type { ReportRange } from './reports-queries';

export function TurnoverCard({ report, currency }: { report: TurnoverReport; currency: string }) {
  return (
    <ReportCard
      title="Selling pace, in detail"
      glyph={faClock}
      blurb={`Measured over the last ${plural(report.periodDays, 'day', 'days')}.`}
    >
      <div className="grid grid-cols-1 gap-2 @md:grid-cols-3">
        <Figure value={NUMBER.format(report.unitsSold)} label="Units sold" />
        <Figure value={formatCents(report.cogsCents, currency)} label="What those goods cost you" />
        <Figure
          value={formatCents(report.avgInventoryValueCents, currency)}
          label="Average value in stock"
        />
      </div>
    </ReportCard>
  );
}

function CogsReasons({ data }: { data: CogsReport }) {
  const peak = Math.max(1, ...data.byReason.map((r) => Math.abs(r.costCents)));
  return (
    <ul className="flex flex-col gap-3">
      {data.byReason.map((row) => (
        <li key={row.reason} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Text className="font-medium">{cogsReasonLabel(row.reason)}</Text>
            <Text className="text-sm tabular-nums">
              {formatCents(row.costCents, data.currency)} · {plural(row.units, 'unit', 'units')}
            </Text>
          </div>
          <div className="bg-base-200 h-2 w-full overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full ${row.reason === 'sale' ? 'bg-success' : 'bg-danger'} ${barWidthClass(
                Math.abs(row.costCents) / peak
              )}`}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Cost of goods over the period, split by why the goods left.
 *
 * The figure was stamped on each movement at the moment the stock went, so it
 * does not drift when tomorrow's delivery moves the average — last quarter's
 * margin stays last quarter's margin. Splitting by reason is what turns one
 * number into a decision: goods sold is cost of sales, goods lost is a problem,
 * and adding them together hides the second inside the first.
 */
export function CostOfGoodsCard({ range, locationId }: { range: ReportRange; locationId: string }) {
  const report = useCogsReport(range, locationId || undefined);
  if (report.isError || !report.data) return null;
  const data = report.data;
  if (data.byReason.length === 0) return null;
  const notSold = data.totalCostCents - data.saleCostCents;

  return (
    <ReportCard
      title="What the goods that left cost you"
      glyph={faCoins}
      blurb="Recorded when each item went, so it does not move when the next delivery changes your average. This is the number your margin is worked out from."
    >
      <div className="grid grid-cols-2 gap-2">
        <Figure
          value={formatCents(data.saleCostCents, data.currency)}
          label="Cost of what you sold"
        />
        <Figure
          tone={notSold > 0 ? 'danger' : undefined}
          value={formatCents(notSold, data.currency)}
          label="Cost of what left without being sold"
        />
      </div>

      <CogsReasons data={data} />

      {data.unattributedUnits > 0 ? (
        <Text className="text-sm">
          {plural(data.unattributedUnits, 'unit', 'units')} left in this period before costs began
          being recorded against each movement, so they are not in the figures above.
        </Text>
      ) : null}
    </ReportCard>
  );
}
