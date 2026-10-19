// Sparx persona issue 360: billed against collected, per day.

import { describe, expect, it } from 'vitest';

import { collectedChartOption, everyDay } from './collected-chart-option';

const colors = { billed: 'rgb(0, 0, 255)', collected: 'rgb(0, 160, 0)' };

describe('everyDay', () => {
  it('keeps the quiet days on the axis', () => {
    const days = everyDay(
      [
        { bucket: '2026-10-06', billedCents: 521580, collectedCents: 51384 },
        { bucket: '2026-10-09', billedCents: 240390, collectedCents: 211960 },
      ],
      '2026-10-05',
      5
    );
    expect(days.map((day) => day.bucket)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
    ]);
    expect(days[0]).toEqual({ bucket: '2026-10-05', billedCents: 0, collectedCents: 0 });
    expect(days[4]?.collectedCents).toBe(211960);
  });
});

describe('collectedChartOption', () => {
  it('draws billed and collected, each in its own color, so the key matches', () => {
    const series = collectedChartOption(
      [{ bucket: '2026-10-06', billedCents: 100, collectedCents: 50 }],
      colors,
      'USD'
    ).series as { name: string; itemStyle?: { color?: string }; data: number[] }[];
    expect(series.map((s) => [s.name, s.itemStyle?.color, s.data])).toEqual([
      ['Billed', colors.billed, [100]],
      ['Collected', colors.collected, [50]],
    ]);
  });
});
