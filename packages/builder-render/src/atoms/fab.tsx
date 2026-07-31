// FAB / speed dial — a floating action button pinned to a corner of the frame,
// with optional actions that reveal on hover/focus.
//
// silicaui has no FAB, so this is one of the sparx components that fills a gap in
// the library (root CLAUDE.md RULE #1). It is not a NEW control: the button itself
// IS a silica button — `buttonClasses()` emits the real `btn btn-<color> btn-circle
// btn-lg`, so it inherits the theme, the variants and the focus ring. Everything
// this file adds on top is layout: fixed positioning, a stack for the actions, and
// the reveal transition — all Tailwind utilities.
//
// SERVER component: `buttonClasses` comes from silicaui-react's `/server` entry
// (the main entry is a `'use client'` module), and the reveal is pure CSS, so the
// live storefront ships this with no JavaScript at all.

import * as React from 'react';
import { buttonClasses, cx } from '@wizeworks/silicaui-react/server';
import type { ButtonColor } from '@wizeworks/silicaui-react/server';

export type FABPlacement = 'bottom-end' | 'bottom-start' | 'top-end' | 'top-start';

export interface FABProps {
  /** Color slot for the main button. Defaults to `primary`. */
  color?: ButtonColor;
  /** Corner placement. Defaults to `bottom-end`. */
  placement?: FABPlacement;
  /** Renders the main control as a link instead of a button. */
  href?: string;
  'aria-label': string;
  /** Optional speed-dial actions revealed on hover/focus. */
  actions?: React.ReactNode;
  className?: string;
  id?: string;
  /** The main button icon/content. */
  children?: React.ReactNode;
}

// Corner offsets. `end`/`start` are logical, so an RTL site pins to the mirrored
// corner without a second rule.
const PLACEMENT: Record<FABPlacement, string> = {
  'bottom-end': 'bottom-6 end-6 flex-col',
  'bottom-start': 'bottom-6 start-6 flex-col',
  'top-end': 'top-6 end-6 flex-col-reverse',
  'top-start': 'top-6 start-6 flex-col-reverse',
};

export function FAB({
  color = 'primary',
  placement = 'bottom-end',
  href,
  actions,
  className,
  id,
  children,
  ...aria
}: FABProps): React.ReactElement {
  const label = aria['aria-label'];
  const mainClass = buttonClasses({ color, size: 'lg', shape: 'circle' });
  return (
    <div
      className={cx('group fixed z-40 flex items-center gap-3', PLACEMENT[placement], className)}
      id={id}
    >
      {actions ? (
        // Collapsed at rest and taken out of the tab order by `invisible`, so a
        // keyboard user reaches the main button first; focus *within* the stack
        // (group-focus-within) keeps it open once they tab in.
        <div className="invisible flex flex-col items-center gap-2 opacity-0 transition-all duration-200 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
          {actions}
        </div>
      ) : null}
      {href ? (
        <a href={href} className={mainClass} aria-label={label}>
          {children}
        </a>
      ) : (
        <button type="button" className={mainClass} aria-label={label}>
          {children}
        </button>
      )}
    </div>
  );
}
FAB.displayName = 'FAB';
