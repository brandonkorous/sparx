// Divider — a full-width hairline in the tenant border color (docs/46 §5.2).
// SERVER component. Harvested from the storefront renderer's Divider leaf.

import * as React from 'react';
import { cx } from '../utils/cx';

export interface DividerProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Divider({ className, style }: DividerProps) {
  return <hr className={cx('sf-divider', className)} style={style} />;
}
Divider.displayName = 'Divider';
