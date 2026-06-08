// Navbar — a top navigation bar (docs/46 §5.2). Compound (Start / Center / End).
// SERVER component, structural. The three slots distribute across the bar.
//
// Composition: BASIC (docs/23 §17) — a structural bar shell. It exposes slots but
// composes no specific components itself; the author fills them (e.g. a Logo + a
// CollapsibleNav).

import * as React from 'react';
import { cx } from '../utils/cx';

export interface NavbarProps {
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export interface NavbarSlotProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

function NavbarRoot({ className, style, id, children }: NavbarProps): React.ReactElement {
  return (
    <nav className={cx('sf-navbar', className)} style={style} id={id}>
      {children}
    </nav>
  );
}
NavbarRoot.displayName = 'Navbar';

function NavbarStart({ className, style, children }: NavbarSlotProps): React.ReactElement {
  return (
    <div className={cx('sf-navbar__start', className)} style={style}>
      {children}
    </div>
  );
}
NavbarStart.displayName = 'NavbarStart';

function NavbarCenter({ className, style, children }: NavbarSlotProps): React.ReactElement {
  return (
    <div className={cx('sf-navbar__center', className)} style={style}>
      {children}
    </div>
  );
}
NavbarCenter.displayName = 'NavbarCenter';

function NavbarEnd({ className, style, children }: NavbarSlotProps): React.ReactElement {
  return (
    <div className={cx('sf-navbar__end', className)} style={style}>
      {children}
    </div>
  );
}
NavbarEnd.displayName = 'NavbarEnd';

const Navbar = Object.assign(NavbarRoot, {
  Start: NavbarStart,
  Center: NavbarCenter,
  End: NavbarEnd,
});

export { Navbar, NavbarStart, NavbarCenter, NavbarEnd };
