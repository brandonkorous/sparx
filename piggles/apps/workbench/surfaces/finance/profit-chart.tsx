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
import { Chart, type EChartsOption } from '@wizeworks/silicaui-charts';

export interface ProfitPoint {
    bucket: string;
    revenueCents: number;
    netProfitCents: number;
}

/** Revenue, profit-positive, profit-negative. */
const SERIES_TOKENS = ['--color-info', '--color-success', '--color-error'] as const;

function dayLabel(bucket: string): string {
    const date = new Date(bucket);
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

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

    const option = useMemo<EChartsOption>(() => {
        const [revenueColor, profitColor, lossColor] = colors;
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
                    data: points.map((point) => ({
                        value: point.netProfitCents,
                        // Per-point, so the sign carries the color. This is the whole
                        // reason profit is a bar rather than a second line.
                        itemStyle: {
                            color: point.netProfitCents < 0 ? lossColor : profitColor,
                        },
                    })),
                },
                {
                    name: 'Money in',
                    type: 'line',
                    smooth: true,
                    showSymbol: false,
                    ...(revenueColor ? { itemStyle: { color: revenueColor } } : {}),
                    lineStyle: { width: 2 },
                    data: points.map((point) => point.revenueCents),
                },
            ],
        };
    }, [points, colors, currency]);

    return (
        <div ref={ref} className="w-full">
            <Chart
                option={option}
                className="h-64! w-full"
                aria-label="Money in and what you kept, per day"
            />
        </div>
    );
}
