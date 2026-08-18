import * as React from 'react';
import { ICON_COUNTER_VAR, ICON_FIELD_PATH, ICON_VIEWBOX } from '../marks';

// The sparx app icon — the favicon / install-tile lockup.
//
// A full-bleed field of brand color with the "x" KNOCKED OUT of it, arms running
// off all four edges. This is a different mark from <Spark>, not a framed copy of
// it: here the letterform is the negative space, so the tile is one filled path
// and the "x" is whatever shows through.
//
// The counter defaults to sparx ink (`--color-secondary`) so the icon reads the
// same everywhere — a favicon that's ink-on-ember in one browser and
// surface-colored in the next is a bug, not adaptivity. Pass `counter="none"`
// for a true knockout that lets a known surface show through (a one-color
// press asset, a mark sitting on brand navy).
//
// Corners stay hard on purpose: every OS applies its own corner mask, and
// pre-rounding double-rounds on iOS/macOS.

export interface AppIconProps extends Omit<React.SVGProps<SVGSVGElement>, 'children' | 'color'> {
  /** Rendered size in px (square). Default 32. */
  size?: number;
  /** Accessible label. When omitted, the icon is decorative (aria-hidden). */
  title?: string;
  /** The field color. Defaults to the `--color-primary` token. */
  field?: string;
  /** Fill behind the knocked-out "x". `'none'` leaves it truly transparent. */
  counter?: string;
}

export function AppIcon({
  size = 32,
  title,
  field = 'var(--color-primary)',
  counter = ICON_COUNTER_VAR,
  ...rest
}: AppIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={ICON_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {/* Painted under the field, so the counter is the only place it shows. */}
      {counter === 'none' ? null : <rect width="160" height="160" fill={counter} />}
      <path d={ICON_FIELD_PATH} fill={field} />
    </svg>
  );
}
