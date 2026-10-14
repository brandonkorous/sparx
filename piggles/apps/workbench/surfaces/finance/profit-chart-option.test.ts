// The key above the profit chart shows the color of what it names.
//
// The bars are colored one by one, green for a day that made money and red for
// one that lost it, and the series had no color of its own. The key draws the
// series color, so it fell back to the chart's first palette color: "What you
// kept" in red over a month of green bars (sparx persona issue 224).

import { describe, expect, it } from 'vitest';

import { profitChartOption, type ProfitPoint } from './profit-chart-option';

const colors = { revenue: 'rgb(0, 0, 255)', profit: 'rgb(0, 160, 0)', loss: 'rgb(220, 0, 0)' };
const october: ProfitPoint[] = [
  { bucket: '2026-10-01', revenueCents: 150264, netProfitCents: 150264 },
  { bucket: '2026-10-02', revenueCents: 705196, netProfitCents: 705196 },
  { bucket: '2026-10-03', revenueCents: 0, netProfitCents: -42000 },
];

interface Bar {
  name: string;
  itemStyle?: { color?: string };
  data: { itemStyle: { color: string } }[];
}

function kept(points: ProfitPoint[]): Bar {
  const series = profitChartOption(points, colors, 'USD').series as Bar[];
  const bar = series.find((s) => s.name === 'What you kept');
  if (!bar) throw new Error('no "What you kept" series');
  return bar;
}

describe('the profit chart key', () => {
  it('shows "What you kept" in the color of a day that made money', () => {
    expect(kept(october).itemStyle?.color).toBe(colors.profit);
  });

  it('still colors each bar by its own day: green kept, red lost', () => {
    expect(kept(october).data.map((d) => d.itemStyle.color)).toEqual([
      colors.profit,
      colors.profit,
      colors.loss,
    ]);
  });

  it('gives no color at all before the theme is read, rather than a wrong one', () => {
    const series = profitChartOption(october, {}, 'USD').series as Bar[];
    expect(series[0]?.itemStyle?.color).toBeUndefined();
  });
});
