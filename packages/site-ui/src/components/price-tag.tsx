// PriceTag — a formatted monetary amount (docs/46 §5.2).
// SERVER component. Harvested from the site renderer's PriceTag leaf
// (`$${n.toFixed(2)}`); `currency` lets the symbol be overridden. An
// absent/non-finite amount renders nothing (an unbound price).

import * as React from 'react';
import { cx } from '../utils/cx';

export interface PriceTagProps {
  amount?: number | null;
  /** Currency symbol prefix. Defaults to `$`. */
  currency?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function PriceTag({ amount, currency = '$', className, style }: PriceTagProps) {
  if (amount == null || !Number.isFinite(amount)) return null;
  return (
    <span className={cx('sf-price', className)} style={style}>
      {`${currency}${amount.toFixed(2)}`}
    </span>
  );
}
PriceTag.displayName = 'PriceTag';
