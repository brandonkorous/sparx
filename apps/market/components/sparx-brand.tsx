import * as React from 'react';

// The sparx brand marks — wordmark + monogram. These are BRAND, not design-
// library: silicaui owns the component vocabulary, but the sparx letterforms are
// sparx's own identity, so they live in the app. (In the platform-wide rollout
// these graduate to a shared `@sparx/brand` package alongside the theme.)
//
// Brand rules (docs/sparx-brand-guide.md §2):
//   - The "x" is ALWAYS sparx Indigo (`--color-primary`) — never a one-color
//     wordmark.
//   - Inter bold (700), tracking -0.03em, lowercase, no period.
//
// Font: rendered with `--font-wordmark` (Inter, loaded per-app via next/font in
// the root layout). Color tokens (`--color-base-content`, `--color-primary`)
// come from the `sparx` silicaui theme.

function join(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

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
  /** Fill for the indigo "x". Defaults to the `--color-primary` token. */
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

export interface WordmarkProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Font size in px. Default 22 (matches marketing header). */
  size?: number;
  /** Render the sparx monogram mark before the wordmark (icon + wordmark lockup). */
  icon?: boolean;
}

export function Wordmark({ size = 22, icon = false, className, style, ...rest }: WordmarkProps) {
  return (
    <span
      className={join(
        'text-base-content font-bold tracking-tight',
        icon && 'inline-flex items-center',
        className
      )}
      style={{
        fontSize: size,
        fontFamily: "var(--font-wordmark, 'Inter', system-ui, sans-serif)",
        fontWeight: 700,
        letterSpacing: '-0.03em',
        lineHeight: 1,
        ...(icon ? { gap: Math.round(size * 0.28) } : {}),
        ...style,
      }}
      {...rest}
    >
      {icon ? (
        <SparxMark size={Math.round(size * 1.5)} />
      ) : (
        <span>
          spar<span className="text-primary">x</span>
        </span>
      )}
    </span>
  );
}
