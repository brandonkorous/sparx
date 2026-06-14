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
  xs: 'st-spinner--sz-xs',
  sm: 'st-spinner--sz-sm',
  md: 'st-spinner--sz-md',
  lg: 'st-spinner--sz-lg',
  xl: 'st-spinner--sz-xl',
};
const KIND_CLASS: Record<SpinnerKind, string> = {
  spinner: 'st-spinner--spinner',
  ring: 'st-spinner--ring',
  dots: 'st-spinner--dots',
  bars: 'st-spinner--bars',
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
      className={cx('st-spinner', KIND_CLASS[kind], SIZE_CLASS[size], className)}
      style={style}
      id={id}
    >
      {kind === 'dots' || kind === 'bars'
        ? Array.from({ length: 3 }, (_, i) => (
            <span
              key={i}
              className={kind === 'dots' ? 'st-spinner__dot' : 'st-spinner__bar'}
              aria-hidden="true"
            />
          ))
        : null}
      <span className="st-spinner__label">{label}</span>
    </span>
  );
}
Spinner.displayName = 'Spinner';
