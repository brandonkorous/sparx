// Grid — a responsive column grid (docs/47 §11 B1). Mobile-first: collapses to a
// single column below the `md` breakpoint, expanding to `cols` columns at `md`+;
// pass `responsive={false}` to keep the column count at every width. SERVER
// component — purely structural, no color axis.

import * as React from 'react';
import { cx } from '../utils/cx';
import type { SizeKey } from './_recipes/variants';

/** Supported fixed column counts. */
export type GridCols = 1 | 2 | 3 | 4 | 5 | 6;

export interface GridProps {
  /** Column count at `md`+ (or at all widths when `responsive` is false).
   *  Defaults to `3`. */
  cols?: GridCols;
  /** Gap between cells. Defaults to `md`. */
  gap?: SizeKey;
  /** When false, the column count holds on mobile too (no single-column
   *  collapse). Defaults to true. */
  responsive?: boolean;
  /** Semantic element. Defaults to `div`. */
  as?: 'div' | 'ul' | 'ol' | 'section';
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

const GAP_CLASS: Record<SizeKey, string> = {
  xs: 'sf-grid--gap-xs',
  sm: 'sf-grid--gap-sm',
  md: 'sf-grid--gap-md',
  lg: 'sf-grid--gap-lg',
  xl: 'sf-grid--gap-xl',
};

export function Grid({
  cols = 3,
  gap = 'md',
  responsive = true,
  as = 'div',
  className,
  style,
  id,
  children,
}: GridProps): React.ReactElement {
  const Tag = as as React.ElementType;
  return (
    <Tag
      className={cx(
        'sf-grid',
        `sf-grid--cols-${cols}`,
        !responsive && 'sf-grid--fixed',
        GAP_CLASS[gap],
        className
      )}
      style={style}
      id={id}
    >
      {children}
    </Tag>
  );
}
Grid.displayName = 'Grid';
