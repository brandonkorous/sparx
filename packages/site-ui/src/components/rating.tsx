// Rating — a star rating (docs/46 §3.6). Color-bearing: filled stars read the role
// var `--c-bg` (default `warning`). Interactive by default (radios, classic
// reverse-order hover/checked fill), or `readOnly` for display. `color` × `size`.
// SERVER component; the radios carry standard form props via `name`.

import * as React from 'react';
import { cx } from '../utils/cx';
import { colorClass, type ColorKey, type SizeKey } from './_recipes/variants';

export interface RatingProps {
  /** Radio group name (required for an interactive rating). */
  name: string;
  /** Number of stars. Defaults to 5. */
  count?: number;
  /** Selected value (1-based). */
  value?: number;
  /** Color slot. Defaults to `warning`. */
  color?: ColorKey | (string & {});
  /** Size. Defaults to `md`. */
  size?: SizeKey;
  /** Render as a non-interactive display. Defaults to false. */
  readOnly?: boolean;
  /** Accessible group label. */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

const SIZE_CLASS: Record<SizeKey, string> = {
  xs: 'st-rating--sz-xs',
  sm: 'st-rating--sz-sm',
  md: 'st-rating--sz-md',
  lg: 'st-rating--sz-lg',
  xl: 'st-rating--sz-xl',
};

export function Rating({
  name,
  count = 5,
  value = 0,
  color = 'warning',
  size = 'md',
  readOnly = false,
  label,
  className,
  style,
  id,
}: RatingProps): React.ReactElement {
  const classes = cx('st-rating', colorClass(color), SIZE_CLASS[size], className);

  if (readOnly) {
    return (
      <span
        role="img"
        aria-label={label ?? `${value} out of ${count}`}
        className={classes}
        style={style}
        id={id}
      >
        {Array.from({ length: count }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cx('st-rating__star', i < value && 'st-rating__star--on')}
          />
        ))}
      </span>
    );
  }

  // Reverse order so the `~` sibling combinator fills the hovered/checked star and
  // every star visually before it (the classic CSS star-rating technique).
  return (
    <span
      role="radiogroup"
      aria-label={label ?? 'Rating'}
      className={cx(classes, 'st-rating--interactive')}
      style={style}
      id={id}
    >
      {Array.from({ length: count }, (_, i) => count - i).map((star) => (
        <label key={star} className="st-rating__item">
          <input
            type="radio"
            name={name}
            value={star}
            defaultChecked={value === star}
            className="st-rating__input"
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
          />
          <span className="st-rating__star" aria-hidden="true" />
        </label>
      ))}
    </span>
  );
}
Rating.displayName = 'Rating';
