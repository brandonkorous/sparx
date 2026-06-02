// NavMenu — a row or stacked list of nav links (docs/46 §5.2). SERVER
// component. Harvested from the storefront renderer's NavMenu leaf. Takes a
// resolved `items: {label,url}[]`; the renderer maps EITHER source — a bound
// array OR the hand-typed `links` fallback (one `Label|/url` per line) — onto
// this contract, so this component never knows which.

import * as React from 'react';
import { cx } from '../utils/cx';

export interface NavItem {
  label: string;
  url: string;
}

export type NavOrientation = 'row' | 'stack';

export interface NavMenuProps {
  items: NavItem[];
  orientation?: NavOrientation;
  className?: string;
  style?: React.CSSProperties;
}

export function NavMenu({ items, orientation = 'row', className, style }: NavMenuProps) {
  const modifier = orientation === 'stack' ? 'sf-nav--stack' : 'sf-nav--row';
  return (
    <nav className={cx('sf-nav', modifier, className)} style={style}>
      {items.map((item, i) =>
        item.label ? (
          <a key={`${i}-${item.label}`} href={item.url || '#'} className="sf-nav__item">
            {item.label}
          </a>
        ) : null
      )}
    </nav>
  );
}
NavMenu.displayName = 'NavMenu';
