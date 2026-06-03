// Avatar — a user/brand image with an initials fallback (docs/46 §3.6). When
// `src` is present it shows the image; otherwise it derives up-to-two initials
// from `name` over a colored placeholder (the `color` axis off the shared recipe
// drives the placeholder fill). Axes: `color` × `size` × `shape`, with an optional
// presence `status` dot. SERVER component, presentational.

import * as React from 'react';
import { cx } from '../utils/cx';
import { colorClass, type ColorKey, type SizeKey } from './_recipes/variants';

export type AvatarShape = 'circle' | 'rounded' | 'square';
export type AvatarStatus = 'online' | 'offline';

export interface AvatarProps {
  src?: string;
  alt?: string;
  /** Used for the initials fallback and as the image alt when `alt` is unset. */
  name?: string;
  /** Placeholder fill color slot (used when there's no image). Defaults to
   *  `neutral`. */
  color?: ColorKey | (string & {});
  /** Size. Defaults to `md`. */
  size?: SizeKey;
  /** Corner shape. Defaults to `circle`. */
  shape?: AvatarShape;
  /** Presence indicator dot. */
  status?: AvatarStatus;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

const SIZE_CLASS: Record<SizeKey, string> = {
  xs: 'sf-avatar--sz-xs',
  sm: 'sf-avatar--sz-sm',
  md: 'sf-avatar--sz-md',
  lg: 'sf-avatar--sz-lg',
  xl: 'sf-avatar--sz-xl',
};
const SHAPE_CLASS: Record<AvatarShape, string> = {
  circle: 'sf-avatar--circle',
  rounded: 'sf-avatar--rounded',
  square: 'sf-avatar--square',
};

/** First letters of the first and last words, up to two, uppercased. */
export function initials(name: string | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0]![0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function Avatar({
  src,
  alt,
  name,
  color = 'neutral',
  size = 'md',
  shape = 'circle',
  status,
  className,
  style,
  id,
}: AvatarProps): React.ReactElement {
  const classes = cx(
    'sf-avatar',
    colorClass(color),
    SIZE_CLASS[size],
    SHAPE_CLASS[shape],
    className
  );
  const dot = status ? (
    <span className={cx('sf-avatar__status', `sf-avatar__status--${status}`)} aria-label={status} />
  ) : null;

  if (src) {
    return (
      <span className={classes} style={style} id={id}>
        <img className="sf-avatar__img" src={src} alt={alt ?? name ?? ''} />
        {dot}
      </span>
    );
  }
  return (
    <span
      className={cx(classes, 'sf-avatar--placeholder')}
      style={style}
      id={id}
      role="img"
      aria-label={alt ?? name ?? 'avatar'}
    >
      <span className="sf-avatar__initials" aria-hidden="true">
        {initials(name)}
      </span>
      {dot}
    </span>
  );
}
Avatar.displayName = 'Avatar';
