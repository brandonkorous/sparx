'use client';

// One bar per day, drawn from layout utilities rather than a chart library.
//
// Heights are quantised to 5% steps so the class set is finite and Tailwind can
// see every one — which is what keeps this free of an inline style.

import { Tooltip } from '@wizeworks/silicaui-react';
import { formatCents, type RevenuePoint } from './reports-data';

const BAR_HEIGHT = [
  'h-px',
  'h-[5%]',
  'h-[10%]',
  'h-[15%]',
  'h-[20%]',
  'h-[25%]',
  'h-[30%]',
  'h-[35%]',
  'h-[40%]',
  'h-[45%]',
  'h-[50%]',
  'h-[55%]',
  'h-[60%]',
  'h-[65%]',
  'h-[70%]',
  'h-[75%]',
  'h-[80%]',
  'h-[85%]',
  'h-[90%]',
  'h-[95%]',
  'h-full',
];

export function RevenueBars({ points, currency }: { points: RevenuePoint[]; currency: string }) {
  const peak = Math.max(1, ...points.map((p) => p.grossCents));
  return (
    <div className="flex h-20 items-end gap-0.5" role="img" aria-label="Sales each day">
      {points.map((point) => {
        const label = new Date(point.bucket).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
        });
        const step = point.grossCents <= 0 ? 0 : Math.round((point.grossCents / peak) * 20);
        return (
          <Tooltip
            key={point.bucket}
            delay={100}
            content={`${label} · ${formatCents(point.grossCents, currency)} · ${
              point.ordersCount === 1 ? '1 order' : `${String(point.ordersCount)} orders`
            }`}
          >
            <div className={`bg-module flex-1 rounded-sm ${BAR_HEIGHT[step] ?? 'h-px'}`} />
          </Tooltip>
        );
      })}
    </div>
  );
}
