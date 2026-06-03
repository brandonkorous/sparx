// Kbd — a keyboard key cap (docs/46 §5.2). SERVER component, structural (no color
// axis): a bordered neutral key across the shared `size` scale.

import * as React from 'react';
import { cx } from '../utils/cx';
import type { SizeKey } from './_recipes/variants';

export interface KbdProps {
  /** Size. Defaults to `md`. */
  size?: SizeKey;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  children?: React.ReactNode;
}

const SIZE_CLASS: Record<SizeKey, string> = {
  xs: 'sf-kbd--sz-xs',
  sm: 'sf-kbd--sz-sm',
  md: 'sf-kbd--sz-md',
  lg: 'sf-kbd--sz-lg',
  xl: 'sf-kbd--sz-xl',
};

export function Kbd({ size = 'md', className, style, id, children }: KbdProps): React.ReactElement {
  return (
    <kbd className={cx('sf-kbd', SIZE_CLASS[size], className)} style={style} id={id}>
      {children}
    </kbd>
  );
}
Kbd.displayName = 'Kbd';
