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
  'M46.74,115.47c-7.97,0-14.44-.99-19.43-2.96-4.99-1.97-8.72-4.67-11.19-8.11-2.47-3.44-3.88-7.38-4.21-11.82l24.53-.63c.5,2.68,1.57,4.68,3.21,5.97,1.64,1.3,4.04,1.95,7.23,1.95,2.6,0,4.55-.44,5.85-1.32,1.3-.88,1.95-2.12,1.95-3.71,0-1.17-.3-2.14-.88-2.89-.59-.75-1.7-1.42-3.33-2.01-1.64-.59-4.05-1.13-7.23-1.64-7.63-1.26-13.61-2.72-17.92-4.4-4.32-1.68-7.36-3.88-9.12-6.6-1.76-2.72-2.64-6.18-2.64-10.38,0-6.79,2.72-12.22,8.17-16.29,5.45-4.07,13.79-6.1,25.03-6.1,7.38,0,13.44,1.01,18.18,3.02,4.74,2.01,8.32,4.84,10.75,8.49,2.43,3.65,3.77,7.95,4.03,12.89l-24.15.75c0-2.09-.36-3.86-1.07-5.28-.71-1.42-1.74-2.49-3.08-3.21-1.34-.71-2.98-1.07-4.91-1.07-2.35,0-4.26.52-5.72,1.57-1.47,1.05-2.2,2.54-2.2,4.47,0,1.26.31,2.31.94,3.14.63.84,1.7,1.51,3.21,2.01,1.51.5,3.52.92,6.04,1.26,7.46.92,13.46,2.31,17.99,4.15,4.53,1.84,7.82,4.21,9.87,7.11,2.05,2.89,3.08,6.4,3.08,10.5,0,6.88-2.87,12.12-8.62,15.72-5.74,3.61-13.86,5.41-24.34,5.41Z';
const X_PATH =
  'M72.26,113.96l23.65-34.21-23.4-33.71h25.16l12.33,19.37,12.07-19.37h25.66l-23.4,33.71,23.77,34.21h-25.16l-12.45-20.12-12.58,20.12h-25.66Z';

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
