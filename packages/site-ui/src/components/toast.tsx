// Toast — a fixed region that stacks transient notifications (docs/46 §5.2). SERVER
// component, structural: a positioned container; the notifications themselves are
// Alerts/Cards passed as children. `horizontal` × `vertical` pin the corner.

import * as React from 'react';
import { cx } from '../utils/cx';

export type ToastHorizontal = 'start' | 'center' | 'end';
export type ToastVertical = 'top' | 'middle' | 'bottom';

export interface ToastProps {
  /** Horizontal anchor. Defaults to `end`. */
  horizontal?: ToastHorizontal;
  /** Vertical anchor. Defaults to `bottom`. */
  vertical?: ToastVertical;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export function Toast({
  horizontal = 'end',
  vertical = 'bottom',
  className,
  style,
  id,
  children,
}: ToastProps): React.ReactElement {
  return (
    <div
      className={cx('sf-toast', `sf-toast--h-${horizontal}`, `sf-toast--v-${vertical}`, className)}
      style={style}
      id={id}
      role="status"
      aria-live="polite"
    >
      {children}
    </div>
  );
}
Toast.displayName = 'Toast';
