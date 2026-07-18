import { BRAND, WORDMARK_ASPECT, WORDMARK_BODY_PATHS, WORDMARK_VIEWBOX, WORDMARK_X_PATH } from '@sparx/brand';

// The sparx wordmark as an inline SVG for the edge OG generators (satori /
// next/og), so every social card renders the REAL vector lockup instead of a
// font approximation. Geometry + the brand "x" color come from @sparx/brand —
// the single source of truth — so a brand refresh never has to be re-applied
// across the ~30 OG routes.
//
// satori renders <svg>/<path>, but it needs an explicit `display` on the root
// element; the wrapping <div> provides it.
export function OgWordmark({
  height = 40,
  /** Body-letter color. White for the dark OG canvas. */
  bodyColor = '#ffffff',
  /** The "x". Defaults to the brand spark color. */
  accent = BRAND.primary,
}: {
  height?: number;
  bodyColor?: string;
  accent?: string;
}) {
  const width = Math.round(height * WORDMARK_ASPECT);
  return (
    <div style={{ display: 'flex' }}>
      <svg width={width} height={height} viewBox={WORDMARK_VIEWBOX} xmlns="http://www.w3.org/2000/svg">
        {WORDMARK_BODY_PATHS.map((d) => (
          <path key={d} d={d} fill={bodyColor} />
        ))}
        <path d={WORDMARK_X_PATH} fill={accent} />
      </svg>
    </div>
  );
}
