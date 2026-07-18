import * as React from 'react';
import { cx } from './cx';
import { Spark } from './spark';
import { WORDMARK_ASPECT, WORDMARK_BODY_PATHS, WORDMARK_VIEWBOX, WORDMARK_X_PATH } from '../marks';

// The sparx wordmark — the real vector "sparx" lockup, the single source of
// truth for the marketing site, the dashboard chrome, and every sidebar rail.
// Geometry lives in ../marks; this only wires color + sizing.
//
// Brand rules (docs/sparx-brand-guide.md §2):
//   - lowercase "sparx", no period, no caps.
//   - The "x" is ALWAYS the brand spark color — never a solid one-color wordmark.
//
// Theming: the body letters use `currentColor` (so they adopt the surrounding
// ink and flip in light/dark with no separate asset) and the "x" uses
// `accentColor`, defaulting to the `--color-primary` token — the same pattern
// <Spark> uses for the mark.

export interface WordmarkProps extends Omit<React.SVGProps<SVGSVGElement>, 'color'> {
  /** Rendered height in px; width scales to the ~2.38:1 artwork. Default 22. */
  size?: number;
  /** Render the square spark mark instead of the full lockup — used to collapse
   *  a sidebar rail down to an icon. */
  icon?: boolean;
  /** Fill for the "x". Defaults to the `--color-primary` token. Pass a literal
   *  hex only where that token isn't loaded (e.g. a tenant public site scoped to
   *  its own `--st-*` theme) — never to recolor it to a different hue. */
  accentColor?: string;
}

export function Wordmark({
  size = 22,
  icon = false,
  accentColor = 'var(--color-primary)',
  className,
  style,
  ...rest
}: WordmarkProps) {
  const resolvedClassName = cx('text-base-content', className);

  if (icon) {
    return (
      <Spark
        size={Math.round(size * 1.5)}
        color={accentColor}
        className={resolvedClassName}
        style={style}
      />
    );
  }

  const width = Math.round(size * WORDMARK_ASPECT * 100) / 100;

  return (
    <svg
      width={width}
      height={size}
      viewBox={WORDMARK_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="sparx"
      className={resolvedClassName}
      style={style}
      {...rest}
    >
      {WORDMARK_BODY_PATHS.map((d) => (
        <path key={d} d={d} fill="currentColor" />
      ))}
      <path d={WORDMARK_X_PATH} fill={accentColor} />
    </svg>
  );
}
