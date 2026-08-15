// A faint, tiled sparx-mark watermark for a recessed base-200 canvas.
//
// Decorative only (aria-hidden) — the sanctioned faded case — so it whispers the
// brand behind the base-100 surfaces lifted onto the canvas without competing with
// them. currentColor rides the Ember `--color-primary` token, so it tracks
// light/dark automatically and stays identical everywhere it's used (the auth
// screen and the onboarding canvas share this ONE definition), and the geometry
// comes from @sparx/brand (never re-inlined).

import { SPARK_PATH, SPARK_VIEWBOX } from '@sparx/brand';

export function SparkField() {
  return (
    <svg aria-hidden className="text-primary pointer-events-none absolute inset-0 h-full w-full">
      <defs>
        <pattern
          id="spark-field"
          width="76"
          height="76"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-12)"
        >
          <svg x="20" y="20" width="34" height="34" viewBox={SPARK_VIEWBOX}>
            <path d={SPARK_PATH} fill="currentColor" fillOpacity={0.1} />
          </svg>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#spark-field)" />
    </svg>
  );
}
