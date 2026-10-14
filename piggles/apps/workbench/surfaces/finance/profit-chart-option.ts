// What the profit chart draws, as an ECharts option: a bar per day for what was
// kept, colored by its own sign, and a line for sales. Kept apart from the
// component so the colors it hands over can be read without a browser.

import type { EChartsOption } from '@wizeworks/silicaui-charts';

export interface ProfitPoint {
  bucket: string;
  revenueCents: number;
  netProfitCents: number;
}

/** The colors the theme resolved: sales, a day that made money, a day that lost it. */
export interface ProfitColors {
  revenue?: string;
  profit?: string;
  loss?: string;
}

function dayLabel(bucket: string): string {
  const date = new Date(bucket);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function profitChartOption(
  points: ProfitPoint[],
  colors: ProfitColors,
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
        name: 'What you kept',
        type: 'bar',
        // The series' own color is what the key draws. Without it the key fell
        // back to the palette's first color, red, over green bars (issue 224).
        ...(colors.profit ? { itemStyle: { color: colors.profit } } : {}),
        data: points.map((point) => ({
          value: point.netProfitCents,
          // Per-point, so the sign carries the color. This is the whole
          // reason profit is a bar rather than a second line.
          itemStyle: {
            color: point.netProfitCents < 0 ? colors.loss : colors.profit,
          },
        })),
      },
      {
        name: 'Sales',
        type: 'line',
        smooth: true,
        showSymbol: false,
        ...(colors.revenue ? { itemStyle: { color: colors.revenue } } : {}),
        lineStyle: { width: 2 },
        data: points.map((point) => point.revenueCents),
      },
    ],
  };
}
