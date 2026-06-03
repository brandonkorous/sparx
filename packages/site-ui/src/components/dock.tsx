// Dock — a bottom navigation dock (docs/46 §5.2). Compound (Dock + Item). SERVER
// component, structural (active item uses the fixed primary accent). An item is an
// `<a>` (href) or a `<span>`; `children` is the icon, `label` the caption.

import * as React from 'react';
import { cx } from '../utils/cx';
import type { SizeKey } from './_recipes/variants';

export interface DockProps {
  /** Size. Defaults to `md`. */
  size?: SizeKey;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

export interface DockItemProps {
  href?: string;
  active?: boolean;
  label?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** The icon. */
  children?: React.ReactNode;
}

const SIZE_CLASS: Record<SizeKey, string> = {
  xs: 'sf-dock--sz-xs',
  sm: 'sf-dock--sz-sm',
  md: 'sf-dock--sz-md',
  lg: 'sf-dock--sz-lg',
  xl: 'sf-dock--sz-xl',
};

function DockRoot({ size = 'md', className, style, id, children }: DockProps): React.ReactElement {
  return (
    <nav className={cx('sf-dock', SIZE_CLASS[size], className)} style={style} id={id}>
      {children}
    </nav>
  );
}
DockRoot.displayName = 'Dock';

function DockItem({
  href,
  active = false,
  label,
  className,
  style,
  children,
}: DockItemProps): React.ReactElement {
  const inner = (
    <>
      <span className="sf-dock__icon" aria-hidden="true">
        {children}
      </span>
      {label != null ? <span className="sf-dock__label">{label}</span> : null}
    </>
  );
  const itemClass = cx('sf-dock__item', active && 'sf-dock__item--active', className);
  return href ? (
    <a href={href} className={itemClass} style={style} aria-current={active ? 'page' : undefined}>
      {inner}
    </a>
  ) : (
    <span className={itemClass} style={style}>
      {inner}
    </span>
  );
}
DockItem.displayName = 'DockItem';

const Dock = Object.assign(DockRoot, { Item: DockItem });

export { Dock, DockItem };
