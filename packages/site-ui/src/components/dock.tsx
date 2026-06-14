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
  xs: 'st-dock--sz-xs',
  sm: 'st-dock--sz-sm',
  md: 'st-dock--sz-md',
  lg: 'st-dock--sz-lg',
  xl: 'st-dock--sz-xl',
};

function DockRoot({ size = 'md', className, style, id, children }: DockProps): React.ReactElement {
  return (
    <nav className={cx('st-dock', SIZE_CLASS[size], className)} style={style} id={id}>
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
      <span className="st-dock__icon" aria-hidden="true">
        {children}
      </span>
      {label != null ? <span className="st-dock__label">{label}</span> : null}
    </>
  );
  const itemClass = cx('st-dock__item', active && 'st-dock__item--active', className);
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
