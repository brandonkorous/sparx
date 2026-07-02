// NavShell — the responsive container a Builder `NavMenu` renders its NavItem
// children into (docs/57 rebuild). SERVER component, CSS-only.
//
// Why not reuse `CollapsibleNav`: that composite renders its links TWICE (an
// inline row + a portalled drawer copy), which is fine for DATA (a plain items
// array) but not for BUILDER NODES — the children here are real nodes whose ids
// double as React keys AND dnd-kit sortable ids, so rendering them twice would
// mint duplicate ids and silently break layer drag-reorder (root CLAUDE.md). So
// NavShell renders its children EXACTLY ONCE and does the row↔hamburger swap in
// pure CSS: a native `<details>` disclosure, the same house pattern the
// `navbar_brand` catalog entry uses for its mobile menu.
//
// The swap is driven by the nearest `st-frame` container query (the Builder
// render frame — `.bx-render` live / `.bx-canvas` in the editor), so it collapses
// at the SIMULATED device width in the canvas preview, not only at the real
// viewport (docs/61 §7, nav-shell.css).
//
// Composition: BASIC (docs/23 §17) — it arranges whatever children it's handed;
// it composes no other named component.

import * as React from 'react';
import { cx } from '../utils/cx';

export type NavShellOrientation = 'row' | 'stack';

export interface NavShellProps {
  /** `row` (primary/header) collapses to a hamburger on narrow frames; `stack`
   *  (footer/secondary) is a plain static column. Defaults to `row`. */
  orientation?: NavShellOrientation;
  /** Accessible label for the nav landmark. Defaults to `Primary`. */
  label?: string;
  className?: string;
  /** The rendered NavItem nodes — rendered once, shared by row and hamburger. */
  children?: React.ReactNode;
}

function HamburgerIcon(): React.ReactElement {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

export function NavShell({
  orientation = 'row',
  label = 'Primary',
  className,
  children,
}: NavShellProps): React.ReactElement {
  // Stacked (footer/secondary) nav: a plain static column — no hamburger, no
  // disclosure. Reuses the existing `.st-nav--stack` link styling.
  if (orientation === 'stack') {
    return (
      <nav className={cx('st-nav', 'st-nav--stack', className)} aria-label={label}>
        {children}
      </nav>
    );
  }

  // Row (primary/header) nav: inline row on wide frames, a hamburger reveal once
  // narrow. Children live in ONE `<details>` panel (rendered once); CSS turns that
  // panel into a static in-bar row on wide frames and a floating dropdown on
  // narrow ones. See nav-shell.css.
  return (
    <nav className={cx('st-navshell', className)} aria-label={label}>
      <details className="st-navshell__disc">
        <summary className="st-navshell__toggle" aria-label={`Toggle ${label.toLowerCase()} menu`}>
          <HamburgerIcon />
        </summary>
        <div className="st-navshell__items st-nav st-nav--row">{children}</div>
      </details>
    </nav>
  );
}
NavShell.displayName = 'NavShell';
