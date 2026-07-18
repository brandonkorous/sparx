import * as React from 'react';
import { SPARK_PATH, SPARK_STROKE_WIDTH, SPARK_VIEWBOX } from '../marks';

// The sparx spark — the brand mark / app-icon glyph. ONE shape, ONE color,
// across every theme (the mark is not two-tone and never inverts). Geometry is
// the single source of truth in ../marks; only the color is a prop here.
//
// Theming: `color` defaults to the `--color-primary` token so the mark tracks
// light/dark + any nested <ModuleProvider> automatically. Pass a literal hex
// only where that token can't resolve (a tenant public site on its own `--st-*`
// theme, or a static export). The stroke rounds the spark's outer corners, so
// fill and stroke share the color to match the source artwork exactly.

export interface SparkProps extends Omit<React.SVGProps<SVGSVGElement>, 'children' | 'color'> {
  /** Rendered size in px (square). Default 24. */
  size?: number;
  /** Accessible label. When omitted, the mark is decorative (aria-hidden). */
  title?: string;
  /** Mark color. Defaults to the `--color-primary` token. */
  color?: string;
}

export function Spark({ size = 24, title, color = 'var(--color-primary)', ...rest }: SparkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={SPARK_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path
        d={SPARK_PATH}
        fill={color}
        stroke={color}
        strokeWidth={SPARK_STROKE_WIDTH}
        strokeLinejoin="round"
        strokeLinecap="square"
      />
    </svg>
  );
}

// Back-compat alias. `SparxMark` used to be the two-tone "sx" monogram; the
// brand's mark is now the single spark, so the old name resolves to <Spark>.
// The retired `accentColor` prop maps to `color` so existing call sites keep
// working without an edit.
export interface SparxMarkProps extends Omit<SparkProps, 'color'> {
  /** @deprecated use `color`. Retained so existing call sites still compile. */
  accentColor?: string;
}

export function SparxMark({ accentColor, ...rest }: SparxMarkProps) {
  return <Spark color={accentColor} {...rest} />;
}
