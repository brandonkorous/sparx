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
    <div
      ref={ref}
      className={cn('rounded-lg bg-[var(--color-bg-subtle)] p-4', className)}
      {...props}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium tracking-wider text-[var(--color-text-tertiary)] uppercase">
          {label}
        </p>
        {icon && (
          <div className="rounded-md bg-[var(--module-active-tint)] p-1.5 text-[var(--module-active)]">
            {icon}
          </div>
        )}
      </div>
      <p className="text-2xl font-medium text-[var(--color-text-primary)]">{value}</p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {delta && (
            <p
              className={cn(
                'text-xs font-medium',
                delta.trend === 'up' && 'text-[var(--color-success-text)]',
                delta.trend === 'down' && 'text-[var(--color-danger-text)]',
                delta.trend === 'neutral' && 'text-[var(--color-text-tertiary)]'
              )}
            >
              {delta.value}
            </p>
          )}
          {hint && !delta && <p className="text-xs text-[var(--color-text-tertiary)]">{hint}</p>}
        </div>
        {chart && <div className="h-8 w-24 shrink-0">{chart}</div>}
      </div>
    </div>
  )
);
Stat.displayName = 'Stat';
