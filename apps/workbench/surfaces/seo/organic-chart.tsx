'use client';

// The organic-traffic trend — clicks and impressions over the last 28 days.
//
// A themed wrapper over silicaui's ECharts (`@wizeworks/silicaui-charts`), the
// sanctioned dataviz stack for this design system. `<Chart>` auto-themes axes,
// gridlines, text and tooltip to the live `--color-*` tokens and re-inits on a
// light/dark flip; what it cannot guess is the SERIES colors, so we resolve the
// ambient module hue (and info) off the DOM and hand ECharts concrete values.
// Reading from a ref inside the pane's module subtree keeps the line in SEO's
// own hue with no wiring.
//
// Self-contained rather than shared from the analytics module: that TrendChart
// is typed to analytics' own series shapes, and reaching across a module
// boundary to reuse it would couple two unrelated surfaces. One small chart for
// one pair of series is the cohesive call.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, type EChartsOption } from '@wizeworks/silicaui-charts';
import type { OrganicPoint } from './data';

const TREND_TOKENS = ['--color-module', '--color-info'] as const;

/** "5 Mar" for a day bucket. */
function dayLabel(bucket: string): string {
    const date = new Date(`${bucket}T00:00:00.000Z`);
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function OrganicChart({ points }: { points: OrganicPoint[] }) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [colors, setColors] = useState<string[]>([]);

    // Resolve the token custom-properties to concrete values ECharts can paint on
    // canvas (it cannot read a CSS `var()`), and re-read when the theme flips.
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const read = () => {
            const cs = getComputedStyle(el);
            setColors(TREND_TOKENS.map((n) => cs.getPropertyValue(n).trim()).filter(Boolean));
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
                    name: 'Visits from search',
                    type: 'line',
                    smooth: true,
                    showSymbol: false,
                    lineStyle: { width: 2 },
                    emphasis: { focus: 'series' },
                    areaStyle: { opacity: 0.16 },
                    data: points.map((p) => p.clicks),
                },
                {
                    name: 'Times shown in results',
                    type: 'line',
                    smooth: true,
                    showSymbol: false,
                    lineStyle: { width: 2 },
                    emphasis: { focus: 'series' },
                    data: points.map((p) => p.impressions),
                },
            ],
        };
    }, [points, colors]);

    return (
        <div ref={ref} className="w-full">
            {/* h-64! beats Chart's inline default height — size via a class, never an
          inline style. */}
            <Chart
                option={option}
                className="h-64! w-full"
                aria-label="Visits from search and times shown in results, over the last 28 days"
            />
        </div>
    );
}
