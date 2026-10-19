// What the "Billed and collected" chart draws (sparx persona issue 360): a pair
// of bars per day, what was invoiced and what came in against invoices. Kept
// apart from the component so it can be read without a browser.
//
// The old dashboard's Invoicing page drew this from the nightly
// `rollup_invoicing_daily_collected`. The workbench never carried it over, so the
// job, its table and the report kept running with nothing reading them.

import type { EChartsOption } from '@wizeworks/silicaui-charts';

export interface CollectedPoint {
  /** The business's calendar date, `YYYY-MM-DD`. */
  bucket: string;
  billedCents: number;
  collectedCents: number;
}

export interface CollectedColors {
  billed?: string;
  collected?: string;
}

/** Every day from `from` for `days` days, with a zero day where nothing moved,
 *  so a quiet week reads as quiet rather than vanishing from the axis. */
export function everyDay(
  points: readonly CollectedPoint[],
  from: string,
  days: number
): CollectedPoint[] {
  const byDay = new Map(points.map((point) => [point.bucket.slice(0, 10), point]));
  const start = Date.parse(`${from}T00:00:00Z`);
  // A start that is not a day draws no axis rather than throwing in render.
  if (Number.isNaN(start)) return [];
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(start + index * 86_400_000);
    const key = Number.isNaN(day.getTime()) ? '' : day.toISOString().slice(0, 10);
    const found = byDay.get(key);
    return {
      bucket: key,
      billedCents: found?.billedCents ?? 0,
      collectedCents: found?.collectedCents ?? 0,
    };
  });
}

function dayLabel(bucket: string): string {
  return new Date(`${bucket}T00:00:00Z`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function collectedChartOption(
  points: readonly CollectedPoint[],
  colors: CollectedColors,
  currency: string
): EChartsOption {
  const money = (cents: number) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  return {
    grid: { left: 6, right: 12, top: 34, bottom: 2, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (value) => money(Number(value)),
    },
    legend: { top: 2, right: 2, icon: 'roundRect', itemWidth: 11, itemHeight: 11, itemGap: 16 },
    xAxis: {
      type: 'category',
      data: points.map((point) => dayLabel(point.bucket)),
      axisTick: { show: false },
      axisLabel: { hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      splitNumber: 4,
      axisLabel: { formatter: (value: number) => money(value) },
    },
    series: [
      {
        name: 'Billed',
        type: 'bar',
        // The series' own color is what the key draws (issue 224).
        ...(colors.billed ? { itemStyle: { color: colors.billed } } : {}),
        data: points.map((point) => point.billedCents),
      },
      {
        name: 'Collected',
        type: 'bar',
        ...(colors.collected ? { itemStyle: { color: colors.collected } } : {}),
        data: points.map((point) => point.collectedCents),
      },
    ],
  };
}
