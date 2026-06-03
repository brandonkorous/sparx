// Spinner (Loading) — an indeterminate activity indicator (docs/46 §5.2). SERVER
// component, structural (color inherits via `currentColor`, no color axis). Four
// kinds — spinner · ring · dots · bars — across the shared `size` scale. Renders
// a visually-hidden label inside `role="status"` so it announces to assistive tech.

import * as React from 'react';
import { cx } from '../utils/cx';
import type { SizeKey } from './_recipes/variants';

export type SpinnerKind = 'spinner' | 'ring' | 'dots' | 'bars';

export interface SpinnerProps {
  /** Animation style. Defaults to `spinner`. */
  kind?: SpinnerKind;
  /** Size. Defaults to `md`. */
  size?: SizeKey;
  /** Accessible label announced to screen readers. Defaults to `Loading`. */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

const SIZE_CLASS: Record<SizeKey, string> = {
  xs: 'sf-spinner--sz-xs',
  sm: 'sf-spinner--sz-sm',
  md: 'sf-spinner--sz-md',
  lg: 'sf-spinner--sz-lg',
  xl: 'sf-spinner--sz-xl',
};
const KIND_CLASS: Record<SpinnerKind, string> = {
  spinner: 'sf-spinner--spinner',
  ring: 'sf-spinner--ring',
  dots: 'sf-spinner--dots',
  bars: 'sf-spinner--bars',
};

export function Spinner({
  kind = 'spinner',
  size = 'md',
  label = 'Loading',
  className,
  style,
  id,
}: SpinnerProps): React.ReactElement {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cx('sf-spinner', KIND_CLASS[kind], SIZE_CLASS[size], className)}
      style={style}
      id={id}
    >
      {kind === 'dots' || kind === 'bars'
        ? Array.from({ length: 3 }, (_, i) => (
            <span
              key={i}
              className={kind === 'dots' ? 'sf-spinner__dot' : 'sf-spinner__bar'}
              aria-hidden="true"
            />
          ))
        : null}
      <span className="sf-spinner__label">{label}</span>
    </span>
  );
}
Spinner.displayName = 'Spinner';
