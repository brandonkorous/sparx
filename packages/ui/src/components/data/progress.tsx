import * as React from 'react';
import { cn } from '../../utils/cn';
import { colorVars, type ColorKey } from '../_recipes/variants';

// Progress — linear determinate/indeterminate bar (docs/35 Tier-A). The
// indicator fill is driven off a per-instance `--sx-sel` custom property set to
// the silicaui color token (default primary). Omit `value` (or pass null) for
// the looping indeterminate state.

const TRACK = {
  solid: 'bg-base-300',
  soft: 'bg-[color-mix(in_oklab,var(--sx-sel)_15%,transparent)]',
} as const;
const TRACK_SIZE = { sm: 'h-1', md: 'h-2', lg: 'h-3' } as const;

export type ProgressVariant = keyof typeof TRACK;
export type ProgressSize = keyof typeof TRACK_SIZE;

export interface ProgressProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'> {
  /** 0–`max`. Omit or pass null for the indeterminate (looping) state. */
  value?: number | null;
  max?: number;
  variant?: ProgressVariant;
  size?: ProgressSize;
  /** Semantic color slot for the fill (default `primary`). */
  color?: ColorKey | (string & {});
  /** Accessible label when there's no visible label element. */
  label?: string;
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      className,
      value,
      max = 100,
      color = 'primary',
      variant = 'solid',
      size = 'md',
      label,
      style,
      ...props
    },
    ref
  ) => {
    const indeterminate = value == null;
    const pct = indeterminate ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
    const { sel } = colorVars(color);

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={indeterminate ? undefined : value}
        aria-label={label}
        style={{ ['--sx-sel']: sel, ...style } as React.CSSProperties}
        className={cn(
          'relative w-full overflow-hidden rounded-full',
          TRACK[variant],
          TRACK_SIZE[size],
          className
        )}
        {...props}
      >
        <div
          className={cn(
            'h-full rounded-full bg-[var(--sx-sel)]',
            indeterminate
              ? 'absolute top-0 [animation:sx-progress-indeterminate_1.4s_ease-in-out_infinite]'
              : 'transition-[width] duration-300'
          )}
          style={indeterminate ? undefined : { width: `${pct}%` }}
        />
      </div>
    );
  }
);
Progress.displayName = 'Progress';
