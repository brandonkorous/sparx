// Stat — a headline figure with a label and optional caption (docs/46 §5.2).
// SERVER component. New with the Tesla-era inventory (spec rows like
// "396 mi · Range"); no inline-renderer baseline yet, so it's a clean design:
// the value uses the heading font, the label inherits, the caption is muted.

import * as React from 'react';
import { cx } from '../utils/cx';

export interface StatProps {
  value: React.ReactNode;
  label?: string;
  caption?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Stat({ value, label, caption, className, style }: StatProps) {
  return (
    <div className={cx('sf-stat', className)} style={style}>
      <span className="sf-stat__value">{value}</span>
      {label ? <span className="sf-stat__label">{label}</span> : null}
      {caption ? <span className="sf-stat__caption">{caption}</span> : null}
    </div>
  );
}
Stat.displayName = 'Stat';
