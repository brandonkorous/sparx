'use client';

// CollapsibleNav — a responsive navbar menu (docs/46 §5.2). The prebuilt
// counterpart to the static `NavMenu`: inline row links on wide screens; a
// hamburger that opens the same links in a slide-in `Drawer` once narrow.
// Composed from the existing `NavMenu` + `Drawer` primitives — no forked
// drawer, no bespoke link list.
//
// The inline↔hamburger swap is driven by the nearest `st-frame` container query
// (the Builder render frame — `.bx-render` live, `.bx-canvas` in the editor), so
// it collapses at the simulated device width in the canvas preview, not only at
// the real viewport (docs/61 §7, collapsible-nav.css).
//
// Drop it into a `Navbar` slot (or any bar) alongside a `Logo` + CTA; it owns
// only the menu's responsive behaviour, never the bar layout.
//
// Composition: COMPOSITE (docs/23 §17) — assembles NavMenu + Drawer.

import * as React from 'react';
import { cx } from '../utils/cx';
import { NavMenu, type NavItem } from './nav-menu';
import { Drawer, DrawerContent, DrawerTitle } from './drawer';

export interface CollapsibleNavProps {
  /** The links — shared by the inline row and the mobile drawer. */
  items: NavItem[];
  /** Edge the mobile drawer slides in from. Defaults to `right`. */
  side?: 'left' | 'right';
  /** Accessible label for the nav landmarks. Defaults to `Primary`. */
  label?: string;
  /** Heading at the top of the mobile drawer. Defaults to `Menu`. */
  drawerTitle?: string;
  /** Extra content rendered below the links inside the drawer (e.g. a CTA). */
  children?: React.ReactNode;
  className?: string;
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

function CloseIcon(): React.ReactElement {
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
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function CollapsibleNav({
  items,
  side = 'right',
  label = 'Primary',
  drawerTitle = 'Menu',
  children,
  className,
}: CollapsibleNavProps): React.ReactElement | null {
  const [open, setOpen] = React.useState(false);
  if (items.length === 0) return null;

  return (
    <div className={cx('st-collapsenav', className)}>
      {/* Wide screens: inline row links (hidden below the breakpoint). */}
      <NavMenu items={items} orientation="row" className="st-collapsenav__inline" />

      {/* Narrow screens: hamburger opens the same links in a drawer. */}
      <Drawer open={open} onOpenChange={setOpen}>
        <Drawer.Trigger
          className="st-collapsenav__toggle"
          aria-label={`Open ${label.toLowerCase()} menu`}
        >
          <HamburgerIcon />
        </Drawer.Trigger>
        <DrawerContent
          side={side}
          className="st-collapsenav__panel"
          aria-label={label}
          aria-describedby={undefined}
        >
          <div className="st-collapsenav__head">
            <DrawerTitle className="st-collapsenav__title">{drawerTitle}</DrawerTitle>
            <Drawer.Close className="st-collapsenav__toggle" aria-label="Close menu">
              <CloseIcon />
            </Drawer.Close>
          </div>
          {/* Close on any link activation (SPA nav doesn't unmount the drawer). */}
          <div
            className="st-collapsenav__links"
            onClickCapture={(e) => {
              if ((e.target as HTMLElement).closest('a')) setOpen(false);
            }}
          >
            <NavMenu items={items} orientation="stack" />
          </div>
          {children ? <div className="st-collapsenav__foot">{children}</div> : null}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
CollapsibleNav.displayName = 'CollapsibleNav';
