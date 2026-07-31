// ToastRegion — a fixed corner region that stacks transient notifications.
//
// silicaui DOES ship a toast, but it is the imperative one: `ToastProvider` plus a
// `toast-viewport` hard-pinned to the bottom-end corner, driven from JavaScript.
// The Builder's Toast is a different thing — an authored, always-present region
// whose corner the author picks and whose contents are dropped nodes (usually
// Alerts). So this is a sparx component filling that gap (root CLAUDE.md RULE #1),
// and it is layout only: it paints nothing, and each notification inside keeps its
// own silica treatment.
//
// SERVER component — a positioned container with no behavior.

import * as React from 'react';
import { cx } from '@wizeworks/silicaui-react/server';

export type ToastHorizontal = 'start' | 'center' | 'end';
export type ToastVertical = 'top' | 'middle' | 'bottom';

const HORIZONTAL: Record<ToastHorizontal, string> = {
  start: 'start-4 items-start',
  center: 'left-1/2 -translate-x-1/2 items-center',
  end: 'end-4 items-end',
};

const VERTICAL: Record<ToastVertical, string> = {
  top: 'top-4',
  middle: 'top-1/2 -translate-y-1/2',
  bottom: 'bottom-4',
};

export interface ToastRegionProps {
  /** Horizontal anchor. Defaults to `end`. */
  horizontal?: ToastHorizontal;
  /** Vertical anchor. Defaults to `bottom`. */
  vertical?: ToastVertical;
  className?: string;
  id?: string;
  children?: React.ReactNode;
}

export function ToastRegion({
  horizontal = 'end',
  vertical = 'bottom',
  className,
  id,
  children,
}: ToastRegionProps): React.ReactElement {
  return (
    <div
      className={cx(
        'fixed z-40 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2',
        HORIZONTAL[horizontal],
        VERTICAL[vertical],
        className
      )}
      id={id}
      role="status"
      aria-live="polite"
    >
      {children}
    </div>
  );
}
ToastRegion.displayName = 'ToastRegion';
