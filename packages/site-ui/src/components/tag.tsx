// Tag (Chip) — a labelled chip for categories / filters (docs/46 §3.6). Like
// Badge, a consumer of the shared recipe — `color` × `variant` (chip treatments)
// × `size` — but field-radiused (not a full pill) and with an optional leading
// status dot. SERVER component, presentational; a removable variant arrives via a
// thin client wrapper later (never an onClick on the base).

import * as React from 'react';
import { cx } from '../utils/cx';
import {
  chipTreatmentVariants,
  colorClass,
  type ChipTreatmentKey,
  type ColorKey,
  type SizeKey,
} from './_recipes/variants';

export interface TagProps {
  /** Semantic color slot. Defaults to `neutral`. */
  color?: ColorKey | (string & {});
  /** Chip treatment. Defaults to `soft`. */
  variant?: ChipTreatmentKey;
  /** Size. Defaults to `md`. */
  size?: SizeKey;
  /** Show a leading status dot in the current color. Defaults to false. */
  dot?: boolean;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  title?: string;
  children?: React.ReactNode;
}

const SIZE_CLASS: Record<SizeKey, string> = {
  xs: 'sf-tag--sz-xs',
  sm: 'sf-tag--sz-sm',
  md: 'sf-tag--sz-md',
  lg: 'sf-tag--sz-lg',
  xl: 'sf-tag--sz-xl',
};

export function Tag({
  color = 'neutral',
  variant = 'soft',
  size = 'md',
  dot = false,
  className,
  style,
  id,
  title,
  children,
}: TagProps): React.ReactElement {
  return (
    <span
      className={cx(
        'sf-tag',
        colorClass(color),
        chipTreatmentVariants[variant],
        SIZE_CLASS[size],
        className
      )}
      style={style}
      id={id}
      title={title}
    >
      {dot ? <span className="sf-tag__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
Tag.displayName = 'Tag';
