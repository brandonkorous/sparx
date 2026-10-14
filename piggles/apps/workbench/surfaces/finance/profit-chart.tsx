'use client';

// Revenue against profit, day by day.
//
// A themed wrapper over silicaui's ECharts (`@wizeworks/silicaui-charts`), the
// sanctioned dataviz stack. `<Chart>` themes axes, gridlines and tooltip from the
// live `--color-*` tokens; series colors it cannot guess, so they are resolved
// off the DOM and handed over as concrete values.
//
// THE COLOR IS THE POINT, not decoration. Profit is drawn as a bar PER DAY whose
// color is decided by its own sign: a day that lost money is red, and it reads
// as a loss before anyone parses a minus sign or finds the zero line. A single
// series color with negative bars hanging below the axis is technically the same
// data and practically a different screen — you have to look for the loss instead
// of being told about it. Revenue rides above as a line, so the gap between the
// two IS the cost of doing the work.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart } from '@wizeworks/silicaui-charts';

import { profitChartOption, type ProfitPoint } from './profit-chart-option';

/** Revenue, profit-positive, profit-negative. */
const SERIES_TOKENS = ['--color-info', '--color-success', '--color-error'] as const;

export function ProfitChart({ points, currency }: { points: ProfitPoint[]; currency: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [colors, setColors] = useState<string[]>([]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const cs = getComputedStyle(el);
      setColors(SERIES_TOKENS.map((name) => cs.getPropertyValue(name).trim()).filter(Boolean));
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class', 'style'],
    });
    return () => observer.disconnect();
  }, []);

  const option = useMemo(() => {
    const [revenue, profit, loss] = colors;
    return profitChartOption(points, { revenue, profit, loss }, currency);
  }, [points, colors, currency]);

  return (
    <div ref={ref} className="w-full">
      <Chart
        option={option}
        className="h-64! w-full"
        aria-label="Sales and what you kept, per day"
      />
    </div>
  );
}
