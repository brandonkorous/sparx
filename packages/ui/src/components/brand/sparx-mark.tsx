import * as React from 'react';

// The sparx monogram mark — the lowercase "sx" glyph drawn from the brand SVG
// (images/SVG/icon.svg). Single source of truth so the favicon lockup, the
// dashboard chrome, and the <Wordmark icon> lockup all render the same shape.
//
// Theming (docs/sparx-brand-guide.md §2):
//   - The "s" uses `currentColor`, so it adopts the surrounding text color and
//     flips correctly in light/dark surfaces.
//   - The "x" is ALWAYS sparx Indigo via `--sparx-primary` — never recolored,
//     matching the wordmark's indigo "x".
//
// For the browser favicon (which can't read our CSS variables) use the static
// app/icon.svg in each app instead; it inlines the hex + a dark-mode media query.

// Paths lifted verbatim from images/SVG/icon.svg (viewBox 0 0 160 160) — the
// lowercase "sx" monogram.
const S_PATH =
  'M48.7,116.39c-6.63,0-12.34-1.47-17.14-4.41-4.81-2.94-8.14-7.21-10.01-12.81l9.93.09c1.12,3.73,2.31,2.94,5.81,5.08,3.5,2.15,7.35,3.22,11.55,3.22,3.92,0,7.16-.96,9.73-2.87,2.56-1.91,3.85-4.55,3.85-7.91,0-2.8-1-5.15-3.01-7.07-2.01-1.91-5.39-3.66-10.15-5.25l-7.56-2.38c-11.2-3.45-16.79-10.08-16.79-19.87,0-5.69,2.22-10.22,6.65-13.57,4.43-3.36,10.01-5.04,16.72-5.04,10.54,0,18.1,4.11,22.67,12.32l-7.84,4.9c-3.73-5.69-8.86-8.54-15.39-8.54-3.45,0-6.49.91-9.1,2.73s-3.92,4.08-3.92,6.79c0,5.23,3.64,9,10.92,11.34l7.98,2.52c12.41,3.92,18.61,10.68,18.61,20.29,0,6.44-2.17,11.45-6.51,15.04-4.34,3.59-10.01,5.39-17,5.39Z';
const X_PATH =
  'M126.13,114.99l-22.81-28.13-22.81,28.13h-12.46l29.11-35.83-21.55-28.11,8.1-4.95,19.46,25.36,20.43-26.45h12.04l-26.31,34.29,29.11,35.69h-12.32Z';

export interface SparxMarkProps extends Omit<React.SVGProps<SVGSVGElement>, 'children'> {
  /** Rendered size in px (square). Default 24. */
  size?: number;
  /** Accessible label. When omitted, the mark is treated as decorative. */
  title?: string;
  /** Fill for the indigo "x". Defaults to the `--sparx-primary` token. Pass the
   *  literal hex only where that token isn't loaded (e.g. a TENANT public site,
   *  scoped to its own `--st-*` theme). This exists to force the SAME indigo as a
   *  literal — never to recolor the mark to a different hue (brand-guide §2). */
  accentColor?: string;
}

export function SparxMark({
  size = 24,
  title,
  accentColor = 'var(--color-primary)',
  ...rest
}: SparxMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path d={S_PATH} fill="currentColor" />
      <path d={X_PATH} fill={accentColor} />
    </svg>
  );
}
