// Skeleton — a content placeholder shown while data loads (docs/46 §5.2).
// SERVER component, structural (no color axis): a pulsing neutral block. `shape`
// switches between a block, a text line, and a circle; `width`/`height` size it
// (number → px, string → as-is).

import * as React from 'react';
import { cx } from '../utils/cx';

export type SkeletonShape = 'block' | 'text' | 'circle';

export interface SkeletonProps {
  /** Placeholder shape. Defaults to `block`. */
  shape?: SkeletonShape;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

const SHAPE_CLASS: Record<SkeletonShape, string> = {
  block: 'sf-skeleton--block',
  text: 'sf-skeleton--text',
  circle: 'sf-skeleton--circle',
};

const dim = (v: number | string | undefined): string | undefined =>
  typeof v === 'number' ? `${v}px` : v;

export function Skeleton({
  shape = 'block',
  width,
  height,
  className,
  style,
  id,
}: SkeletonProps): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cx('sf-skeleton', SHAPE_CLASS[shape], className)}
      style={{ width: dim(width), height: dim(height), ...style }}
      id={id}
    />
  );
}
Skeleton.displayName = 'Skeleton';
