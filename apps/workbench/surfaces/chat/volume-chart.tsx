'use client';

// Conversation volume — started vs resolved, per day over the range.
//
// A themed wrapper over silicaui's ECharts (`@wizeworks/silicaui-charts`), the
// sanctioned dataviz stack. `<Chart>` auto-themes axes, gridlines and tooltip to
// the live `--color-*` tokens; what it cannot guess is the SERIES colours, so we
// resolve the ambient module hue (and success) off the DOM and hand ECharts
// concrete values — which keeps the "started" line in Chat's own hue with no
// wiring. Self-contained rather than shared: it is typed to this one pair of
// series, and reaching across a module boundary to reuse a chart couples two
// unrelated surfaces.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, type EChartsOption } from '@wizeworks/silicaui-charts';
import type { ChatTimeseriesPoint } from './data';

const SERIES_TOKENS = ['--color-module', '--color-success'] as const;

/** "5 Mar" for a day bucket. */
function dayLabel(bucket: string): string {
  const date = new Date(`${bucket}T00:00:00.000Z`);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function VolumeChart({ points }: { points: ChatTimeseriesPoint[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [colors, setColors] = useState<string[]>([]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const cs = getComputedStyle(el);
      setColors(SERIES_TOKENS.map((n) => cs.getPropertyValue(n).trim()).filter(Boolean));
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class', 'style'],
    });
    return () => observer.disconnect();
  }, []);

  const option = useMemo<EChartsOption>(() => {
    const categories = points.map((p) => dayLabel(p.bucket));
    return {
      ...(colors.length ? { color: colors } : {}),
      grid: { left: 6, right: 12, top: 34, bottom: 2, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'line' } },
      legend: { top: 2, right: 2, icon: 'roundRect', itemWidth: 11, itemHeight: 11, itemGap: 16 },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: categories,
        axisTick: { show: false },
        axisLabel: { hideOverlap: true },
      },
      yAxis: { type: 'value', splitNumber: 4, minInterval: 1 },
      series: [
        {
          name: 'Started',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2 },
          emphasis: { focus: 'series' },
          areaStyle: { opacity: 0.16 },
          data: points.map((p) => p.started),
        },
        {
          name: 'Resolved',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2 },
          emphasis: { focus: 'series' },
          data: points.map((p) => p.resolved),
        },
      ],
    };
  }, [points, colors]);

  return (
    <div ref={ref} className="w-full">
      <Chart
        option={option}
        className="h-64! w-full"
        aria-label="Conversations started and resolved, per day"
      />
    </div>
  );
}
