// @piggles/brand — brand MARK geometry, the single source of truth.
//
// Traced from the delivered vector art in piggles/images/SVG (icon.svg,
// wordmark.svg). Everything else — the React components in ./react, app
// favicons, and every OG/social image route — derives from these constants, so a
// brand refresh is a one-file change here rather than a hunt across apps.
//
// Pure data, zero runtime deps: safe to import from ANY surface including the
// edge-runtime OG generators (`next/og`), which cannot resolve CSS variables.
//
// ── COLOUR IS NOT BAKED IN ────────────────────────────────────────────────────
// The source files paint everything in a literal pink — `#fd829a` in icon.svg,
// `#fd849a` in wordmark.svg. Two observations, both deliberate to record:
//
//   1. Those two are not the same value (ΔE 1.2 — imperceptible, but still two
//      numbers for one brand colour).
//   2. Neither matches the approved token `#FF6F86` in brand.tokens.json
//      (ΔE 10.5 and 11.1) — a difference that IS visible side by side, so a
//      literal here would leave the mark a slightly different pink from every
//      button next to it.
//
// So no literal survives the trace: the mark renders in `currentColor` and the
// wordmark's dot in `var(--color-primary)`. The token is the single source of
// truth and the art follows it — which is also what makes the mark correct
// inside a dark theme island for free.

/** Viewport of the standalone mark — the pig-snout "P". Square. */
export const ICON_VIEWBOX = '0 0 269.26 269.26' as const;

/** The "P" body: the stem, the bowl, and the head, with the snout knocked out
 *  of it. The largest shape and the one that reads at favicon size. */
export const ICON_BODY_PATH =
  'M173.51,191.04c-39.49,9.36-71.99-2.28-77.18,1.68-1.42,1.09-3.24,5.33-3.2,7.4l.5,23.37c.15,6.85-1.78,14.21-7.31,18.61-9.98,7.95-22.8,9.72-35.04,4.16-8.78-3.99-19.29-14.6-19.32-27.15l-.22-111.8c-.09-44.61,31.92-81.08,75.32-89.43,44.06-8.48,93.61.36,117.95,40.07,17.03,27.79,18.22,62.98,3.06,91.98-11.14,21.3-31.38,35.62-54.57,41.12M146.54,157.6c22.65-.03,41.37-15.71,46.68-35.24,5.97-21.96-2.5-43.11-21.13-55.39-10.84-7.14-23.1-8.33-36.06-8.21-12.13.11-23.95.88-34.42,7.1-19.81,11.76-29.23,34.09-22.99,56.54,5.46,19.66,24.3,35.27,46.44,35.24l21.48-.03Z';

/** The snout plate. Drawn at ICON_SNOUT_OPACITY so it reads as the pale pink of
 *  the identity board without a second colour token — which is what keeps it
 *  correct on a dark surface, where a baked pale pink would be wrong. */
export const ICON_SNOUT_PATH =
  'M146.54,157.6l-21.48.03c-22.14.03-40.98-15.58-46.44-35.24-6.23-22.45,3.18-44.78,23-56.54,10.48-6.22,22.29-6.99,34.42-7.1,12.96-.12,25.22,1.07,36.06,8.21,18.63,12.28,27.1,33.43,21.13,55.39-5.31,19.53-24.03,35.21-46.68,35.24M123,95.55c-1.13-3.53-6.15-6.61-9.41-6.37-2.6.19-7.21,3.45-8.13,6.44-4.79,15.55-1.81,33.29,9.36,32.8,10.17-.44,12.86-18.3,8.18-32.87M165.33,95.58c-1.12-3.62-6.07-6.6-9.37-6.35-10.46.78-12.86,18.58-8.59,32.52,1.2,3.9,6.36,6.79,9.86,6.62,10.14-.49,12.49-18.58,8.09-32.78';

/** Straight from the source art. The snout is the one place the mark uses a
 *  second value, and it does it with opacity rather than a second hue. */
export const ICON_SNOUT_OPACITY = 0.2 as const;

/** The two nostrils, at full strength on top of the snout plate. */
export const ICON_NOSTRIL_PATHS = [
  'M165.33,95.58c4.4,14.2,2.04,32.3-8.09,32.78-3.5.17-8.66-2.72-9.86-6.62-4.28-13.94-1.87-31.74,8.59-32.52,3.29-.25,8.25,2.73,9.37,6.35',
  'M123,95.55c4.67,14.57,1.99,32.43-8.19,32.87-11.17.48-14.15-17.25-9.36-32.8.92-2.99,5.54-6.25,8.13-6.44,3.27-.24,8.28,2.84,9.41,6.37',
] as const;

// ── Wordmark ─────────────────────────────────────────────────────────────────
// "Piggles" as drawn. The letterforms carry NO fill in the source, so they
// inherit — which is why they render in `currentColor` and flip correctly on a
// dark surface. Only the dot over the "i" is painted, and it is the brand pink.
//
// That split is the wordmark's whole trick and it must survive any edit here:
// recolouring the letters to the brand pink would lose the mark's contrast, and
// making the dot `currentColor` would lose the only spot of brand in the lockup.

export const WORDMARK_VIEWBOX = '0 0 531.08 188.86' as const;
export const WORDMARK_ASPECT = 531.08 / 188.86; // ~2.81:1

/** The letterforms — P, i-stem, g, g, l, e, s. Rendered in `currentColor`. */
export const WORDMARK_LETTER_PATHS = [
  'M47.36,127.6c-.16,7.64-7.67,11.53-13.58,11.32-5.84-.21-12.91-4.44-12.89-11.65l.15-62.59c.06-23.04,19.94-39.21,42-39.27,25.42-.07,44.25,19.46,43.21,44.7-.73,17.89-11.94,32.39-29.11,37.36-9.64,2.79-19.27,2.69-29.32-.94l-.45,21.07ZM59.08,51.67c-10.1,2.8-13.77,12.71-11.2,20.95,2.69,8.66,11.6,12.9,19.97,10.85,9.02-2.21,13.87-11.43,11.29-20.52-2.24-7.89-10.54-13.92-20.06-11.28',
  'M140.95,124.07c.03,8.52-4.79,13.62-11.71,14.55-6.6.88-15.05-3.22-15.05-11.4l.02-55.34c0-7.66,7.39-12.07,13.88-11.77,6.28.29,12.64,5.37,12.67,12.96l.19,51.01Z',
  'M166.03,163.85c-6.52-3.63-7.77-10.57-5.16-15.82,5.79-11.65,18.39-1.59,27.91-1.43,8.06.14,14.63-4.59,15.41-12.77-12.67,6.9-25.98,5.8-38.2-1.29-10.18-5.91-16.92-17.94-17.67-31.12-1.43-24.96,17.2-43.46,42.2-42.85,21.17.52,39.85,15.49,39.88,37.5l.04,34.2c.01,12.1-5.53,24.44-15.35,31.51-14.2,10.22-33.77,10.59-49.06,2.06M187.59,83.12c-9.21,1.14-14.17,9.81-13.14,17.44,1.14,8.42,8.51,13.65,16.5,12.85,8.57-.86,14.25-8,13.47-16.7-.66-7.43-7.6-14.74-16.83-13.59',
  'M254.85,163.87c-6.33-3.57-7.68-10.69-5.01-15.75,6.72-12.75,19.86.46,31.65-1.83,6.53-1.27,11.12-5.67,11.45-12.3-12.5,6.74-26.06,5.7-38.09-1.45-10.25-6.1-16.87-18.33-17.44-31.52-1.07-24.51,17.37-43.05,41.98-42.43,21.26.53,40,15.45,39.97,37.58l-.04,35.43c-.01,12.25-5.97,24.09-16.02,30.85-14.3,9.61-33.31,9.96-48.44,1.44M276.48,83.24c-9.28,1.17-14.07,9.58-13.06,17.18,1.15,8.63,8.41,13.67,16.48,12.94,8.58-.79,14.09-8.15,13.39-16.67-.63-7.62-7.69-14.6-16.81-13.44',
  'M355.08,126.81c.02,8.27-7.46,11.94-13.6,11.99-5.47.04-13.21-4.18-13.21-11.42l.04-91.48c0-7.06,7.93-10.33,13.23-10.41,5.05-.07,13.32,3.37,13.34,10.49l.2,90.82Z',
  'M389.21,108.26c7.32,11.66,19.39,9.07,29.02,5.16,5.89-2.39,12.49-.11,14.99,4.57,2.87,5.39,1.18,12.31-4.7,15.37-15.47,8.05-34.97,8.99-49.78-1.49-20.74-14.68-22.22-45.95-3.71-63.06,11.62-10.74,28.24-12.62,42.62-7.46,13.38,4.81,22.24,16.38,23.35,30.55.78,9.32-6.19,16.17-15.52,16.21l-36.26.15ZM416.3,91.09c-2.26-9.06-8.39-10.99-14.46-10.8-5.84.18-11.41,3.71-13.56,10.94l28.02-.14Z',
  'M495.9,135.77c-14.33,6.22-30.65,4.35-43.21-3.72-5.46-3.51-6.17-10.7-3.77-14.96,3.1-5.51,10.15-6.86,15.91-3.93,10.39,5.28,19.58,6.16,20.21,1.31.15-1.12-1.88-3.55-3.13-3.94l-17.35-5.43c-9.28-2.9-15.57-9.98-16.39-18.66-.84-8.81,2.71-17.86,11.01-22.67,13.02-7.54,29.99-7.17,42.58,1.03,4.67,3.04,5.65,9.7,4.06,13.56-2.29,5.59-8.38,7.53-14.51,5.06-8.75-3.52-17.43-5.36-18.19-.32-.16,1.06,1.68,3.62,2.76,3.92l16.8,4.72c10.17,2.86,16.68,10.92,17.47,20.32.83,9.87-4.05,19.28-14.26,23.71',
] as const;

/** The dot over the "i" — the one painted element in the lockup, and the only
 *  spot of brand colour in it. Always the brand pink, never `currentColor`. */
export const WORDMARK_DOT_PATH =
  'M120.67,27.21c8.18-4.16,16.91-.79,20.25,6.61,3.14,6.97.85,15.85-6.19,19.66-6.91,3.74-15.62,1.18-19.46-4.96-4.36-6.97-2.61-17.24,5.41-21.32';

// ─── The full logo lockup ───────────────────────────────────────────────────
//
// The delivered `images/SVG/logo.svg` is NOT the two standalone files placed
// side by side at a gap somebody chose. It is its own artwork with its own
// canvas, and the earlier implementation of <Logo> — an `inline-flex` with
// `gap-3` and independently sized children — was an approximation of it that
// got the proportions and the spacing wrong.
//
// It IS, however, the same geometry: comparing every path in logo.svg against
// the standalone files shows byte-identical bodies at scale 1, differing only by
// a constant translation. So the lockup can be rebuilt from the constants above
// rather than by pasting a third copy of every path — one source of geometry,
// and the exact delivered spacing.
//
// Measured off logo.svg, not eyeballed:
//   • the wordmark sits at (+214.03, +21.32)
//   • the icon sits at (−31.75, −14.93)
// Both source viewBoxes carry padding, which is why the icon's offset is
// NEGATIVE and why the two boxes overlap — a positive flex gap between them was
// always going to be wrong.
//
// If the art is revised, re-derive these two offsets from the new logo.svg; do
// not nudge them to taste.

export const LOGO_VIEWBOX = '0 0 724.29 234.55' as const;
export const LOGO_ASPECT = 724.29 / 234.55; // ~3.09:1

/** Where the icon's own viewBox origin sits inside the lockup canvas. */
export const LOGO_ICON_OFFSET = { x: -31.75, y: -14.93 } as const;

/** Where the wordmark's own viewBox origin sits inside the lockup canvas. */
export const LOGO_WORDMARK_OFFSET = { x: 214.03, y: 21.32 } as const;
