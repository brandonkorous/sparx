// NavMenu — a row or stacked list of nav links (docs/46 §5.2). SERVER
// component. Harvested from the site renderer's NavMenu leaf. Takes a
// resolved `items: {label,url}[]`; the renderer maps EITHER source — a bound
// array OR the hand-typed `links` fallback (one `Label|/url` per line) — onto
// this contract, so this component never knows which.
//
// Composition: BASIC (docs/23 §17) — self-contained, composes no other component.

import * as React from 'react';
import { cx } from '../utils/cx';

export interface NavItem {
  label: string;
  url: string;
  /** Open the link in a new tab (docs/57). Adds target + safe rel. */
  openInNewTab?: boolean;
}

export type NavOrientation = 'row' | 'stack';

export interface NavMenuProps {
  items: NavItem[];
  orientation?: NavOrientation;
  className?: string;
  style?: React.CSSProperties;
}

export function NavMenu({ items, orientation = 'row', className, style }: NavMenuProps) {
  const modifier = orientation === 'stack' ? 'st-nav--stack' : 'st-nav--row';
  return (
    <nav className={cx('st-nav', modifier, className)} style={style}>
      {items.map((item, i) =>
        item.label ? (
          <a
            key={`${i}-${item.label}`}
            href={item.url || '#'}
            className="st-nav__item"
            {...(item.openInNewTab ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
          >
            {item.label}
          </a>
        ) : null
      )}
    </nav>
  );
}
NavMenu.displayName = 'NavMenu';
