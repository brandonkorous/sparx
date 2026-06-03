// Mask — clips its content to a decorative shape (docs/46 §5.2). SERVER component,
// structural. Geometric shapes use `clip-path`; organic shapes (squircle, heart)
// use an SVG `mask`. Typically wraps an `<img>` or a colored box.

import * as React from 'react';
import { cx } from '../utils/cx';

export type MaskShape =
  | 'squircle'
  | 'circle'
  | 'hexagon'
  | 'triangle'
  | 'diamond'
  | 'star'
  | 'heart';

export interface MaskProps {
  /** Clip shape. Defaults to `squircle`. */
  shape?: MaskShape;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export function Mask({
  shape = 'squircle',
  className,
  style,
  id,
  children,
}: MaskProps): React.ReactElement {
  return (
    <div className={cx('sf-mask', `sf-mask--${shape}`, className)} style={style} id={id}>
      {children}
    </div>
  );
}
Mask.displayName = 'Mask';
