import * as React from 'react';
import { cn } from '../../utils/cn';

// Stat — metric card per doc 23 §8. Single visual style (no CVA variants).
// Icon tint uses --module-active so a wrapping ModuleProvider colors it.

export interface StatDelta {
  value: string;
  trend: 'up' | 'down' | 'neutral';
}

export interface StatProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  label: string;
  value: React.ReactNode;
  delta?: StatDelta;
  icon?: React.ReactNode;
  hint?: React.ReactNode;
  /** Optional inline visual (e.g. a <Sparkline/>) rendered to the right of the
   *  delta/hint — turns a bare metric tile into a KPI tile with a trend. */
  chart?: React.ReactNode;
}

export const Stat = React.forwardRef<HTMLDivElement, StatProps>(
  ({ className, label, value, delta, icon, hint, chart, ...props }, ref) => (
    <div ref={ref} className={cn('bg-base-200 rounded-lg p-4', className)} {...props}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-base-content/50 text-xs font-medium tracking-wider uppercase">{label}</p>
        {icon && <div className="bg-module bg-soft text-module rounded-md p-1.5">{icon}</div>}
      </div>
      <p className="text-base-content text-2xl font-medium">{value}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {delta && (
            <p
              className={cn(
                'text-xs font-medium',
                delta.trend === 'up' && 'text-success',
                delta.trend === 'down' && 'text-danger',
                delta.trend === 'neutral' && 'text-base-content/50'
              )}
            >
              {delta.value}
            </p>
          )}
          {hint && !delta && <p className="text-base-content/50 text-xs">{hint}</p>}
        </div>
        {chart && <div className="h-8 w-24 shrink-0">{chart}</div>}
      </div>
    </div>
  )
);
Stat.displayName = 'Stat';
