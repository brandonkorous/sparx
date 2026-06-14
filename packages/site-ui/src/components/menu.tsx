// Menu — a vertical/horizontal list of nav items (docs/46 §5.2). Compound (Menu +
// Item). SERVER component, structural (the active item uses the fixed primary
// accent). An item renders an `<a>` when given `href`, else a non-interactive
// `<span>` (no onClick on the base).

import * as React from 'react';
import { cx } from '../utils/cx';
import type { SizeKey } from './_recipes/variants';

export type MenuOrientation = 'vertical' | 'horizontal';

export interface MenuProps {
  /** Flow direction. Defaults to `vertical`. */
  orientation?: MenuOrientation;
  /** Size. Defaults to `md`. */
  size?: SizeKey;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export interface MenuItemProps {
  href?: string;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const SIZE_CLASS: Record<SizeKey, string> = {
  xs: 'st-menu--sz-xs',
  sm: 'st-menu--sz-sm',
  md: 'st-menu--sz-md',
  lg: 'st-menu--sz-lg',
  xl: 'st-menu--sz-xl',
};

function MenuRoot({
  orientation = 'vertical',
  size = 'md',
  className,
  style,
  id,
  children,
}: MenuProps): React.ReactElement {
  return (
    <ul
      className={cx('st-menu', `st-menu--${orientation}`, SIZE_CLASS[size], className)}
      style={style}
      id={id}
    >
      {children}
    </ul>
  );
}
MenuRoot.displayName = 'Menu';

function MenuItem({
  href,
  active = false,
  disabled = false,
  className,
  style,
  children,
}: MenuItemProps): React.ReactElement {
  const itemClass = cx(
    'st-menu__item',
    active && 'st-menu__item--active',
    disabled && 'st-menu__item--disabled',
    className
  );
  return (
    <li className="st-menu__li" style={style}>
      {href && !disabled ? (
        <a href={href} className={itemClass} aria-current={active ? 'page' : undefined}>
          {children}
        </a>
      ) : (
        <span className={itemClass} aria-disabled={disabled || undefined}>
          {children}
        </span>
      )}
    </li>
  );
}
MenuItem.displayName = 'MenuItem';

const Menu = Object.assign(MenuRoot, { Item: MenuItem });

export { Menu, MenuItem };
