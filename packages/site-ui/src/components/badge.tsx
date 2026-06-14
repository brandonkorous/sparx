// Badge — a compact status / count pill (docs/46 §3.6). A thin consumer of the
// shared recipe: `color` × `variant` (the chip treatment subset — solid · soft ·
// outline · dashed) × `size`. SERVER component, presentational.

import * as React from 'react';
import { cx } from '../utils/cx';
import {
  chipTreatmentVariants,
  colorClass,
  type ChipTreatmentKey,
  type ColorKey,
  type SizeKey,
} from './_recipes/variants';

export interface BadgeProps {
  /** Semantic color slot. Defaults to `neutral`. Any string is accepted so a
   *  runtime custom color works once its `.st-c-*` rule exists. */
  color?: ColorKey | (string & {});
  /** Chip treatment. Defaults to `solid`. */
  variant?: ChipTreatmentKey;
  /** Size. Defaults to `md`. */
  size?: SizeKey;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  title?: string;
  children?: React.ReactNode;
}

const SIZE_CLASS: Record<SizeKey, string> = {
  xs: 'st-badge--sz-xs',
  sm: 'st-badge--sz-sm',
  md: 'st-badge--sz-md',
  lg: 'st-badge--sz-lg',
  xl: 'st-badge--sz-xl',
};

export function Badge({
  color = 'neutral',
  variant = 'solid',
  size = 'md',
  className,
  style,
  id,
  title,
  children,
}: BadgeProps): React.ReactElement {
  return (
    <span
      className={cx(
        'st-badge',
        colorClass(color),
        chipTreatmentVariants[variant],
        SIZE_CLASS[size],
        className
      )}
      style={style}
      id={id}
      title={title}
    >
      {children}
    </span>
  );
}
Badge.displayName = 'Badge';
