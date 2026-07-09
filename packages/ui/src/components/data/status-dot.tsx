import * as React from 'react';
import { cn } from '../../utils/cn';
import { type ColorKey } from '../_recipes/variants';

// StatusDot — a small presence/status indicator dot (docs/35 Tier-A), composed
// from silicaui's `.status` component class; optional pulse halo.

const DOT_SIZE = { sm: 'status-sm', md: 'status-md', lg: 'status-lg' } as const;

export type StatusDotSize = keyof typeof DOT_SIZE;

export interface StatusDotProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'> {
  /** Semantic color slot (default `neutral`). */
  color?: ColorKey | (string & {});
  size?: StatusDotSize;
  /** Animate an expanding halo (e.g. "live"/"online"). */
  pulse?: boolean;
  /** Accessible label; when set the dot is exposed as a status to AT. */
  label?: string;
}

export const StatusDot = React.forwardRef<HTMLSpanElement, StatusDotProps>(
  ({ className, color = 'neutral', size = 'md', pulse = false, label, ...props }, ref) => {
    const dot = cn('status', `status-${color}`, DOT_SIZE[size]);
    return (
      <span
        ref={ref}
        role={label ? 'status' : undefined}
        aria-label={label}
        className={cn('relative inline-flex', className)}
        {...props}
      >
        {pulse && (
          <span aria-hidden className={cn(dot, 'absolute inset-0 animate-ping opacity-75')} />
        )}
        <span aria-hidden className={dot} />
      </span>
    );
  }
);
StatusDot.displayName = 'StatusDot';
