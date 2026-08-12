// @sparx/brand — brand MARK geometry + colors, the single source of truth.
//
// This is the one place the sparx spark, wordmark, and mascot artwork lives.
// Everything else (the React components in ./react, the app favicons, and every
// OG/social image route) derives from these constants — so a brand refresh is a
// one-file change here, never a hunt across apps.
//
// Pure data, zero runtime deps: safe to import from ANY surface, including the
// edge-runtime OG generators (`next/og`) and the marketing bundles that must not
// pull the server-coupled @sparx/ui shell graph.
//
// Colors mirror the `[data-theme="sparx"]` tokens in theme.css. Live UI should
// prefer the CSS variables (`var(--color-primary)`) so light/dark + module
// theming flow automatically; these hexes are the fallback for contexts where
// CSS variables don't resolve (satori/ImageResponse, a raster favicon, a tenant
// site scoped to its own `--st-*` theme).

/** Brand hexes, kept in sync with theme.css `[data-theme='sparx']`. */
export const BRAND = {
  /** sparx spark — the primary brand color and the wordmark "x". */
  primary: '#e04631',
  /** Foreground on `primary`. */
  primaryContent: '#ffffff',
  /** sparx ink — the deep navy the wordmark body + mascot face are drawn in. */
  ink: '#0c1433',
  /** Foreground on `ink`. */
  inkContent: '#ffffff',
  /** Paper white — the light canvas. */
  paper: '#ffffff',
} as const;

/**
 * Per-module identity hues, mirroring the `--color-module-*` tokens in
 * theme.css. These are CONSTANT across light and dark — a module's hue is its
 * identity, not a themed surface — which is exactly why a literal hex is safe
 * here and nowhere else.
 *
 * This is the ONLY TypeScript copy in the repo. Live UI must NOT read it: use
 * the silica utilities (`bg-module-crm`, `text-module-crm`, `bg-module-crm
 * bg-soft` for the wash) so light/dark and any theme override flow through.
 * This map exists for the contexts where CSS custom properties genuinely don't
 * resolve — satori/`ImageResponse` OG routes, raster favicons, canvas.
 */
export const MODULE_HEX = {
  builder: '#4f46e5',
  commerce: '#f97316',
  cms: '#14b8a6',
  crm: '#06b6d4',
  invoicing: '#4d7c0f',
  email: '#0ea5e9',
  b2b: '#475569',
  dropship: '#10b981',
  inventory: '#f59e0b',
  chat: '#7c3aed',
  scheduling: '#e11d48',
  ai: '#db2777',
  automations: '#c026d3',
  seo: '#eab308',
  social: '#2563eb',
  finance: '#16a34a',
} as const;

export type ModuleKey = keyof typeof MODULE_HEX;

// ── Spark (the mark) ─────────────────────────────────────────────────────────
// The sparx "x", standing alone. One shape, one color, across every theme.
// Drawn from images/new/SVG/icon.svg (viewBox 0 0 160 160) — the same letterform
// as the wordmark's "x", which is why the mark and the lockup read as one brand.
//
// Optically centred inside the viewBox (110.9 × 103.3 of 160, ~24px of air on
// every side), so it sits correctly as an inline glyph at 20–24px with no
// caller-side nudging. Pure fill, no stroke — the 2026-07 refresh retired the
// four-lobed spark glyph (and with it SPARK_STROKE_WIDTH) for this letterform.

export const SPARK_VIEWBOX = '0 0 160 160' as const;
export const SPARK_PATH =
  'M108.14,131.63l-27.88-34.9-27.88,34.9h-27.67l41.09-51.42-31.69-42.3,19.91-9.53,26.02,34.69,26.02-34.69h27.26l-38.82,51.83,41.1,51.42h-27.47Z';

// ── App icon (the knockout tile) ─────────────────────────────────────────────
// The favicon / app-icon lockup: a full-bleed field of brand color with the "x"
// KNOCKED OUT of it, arms running off all four edges. Drawn from
// images/new/SVG/icon-square.svg (viewBox 0 0 160 160).
//
// This is a distinct mark from SPARK_PATH above, not a container for it — the
// "x" here is the negative space, so the tile is ONE path (the field) and the
// letterform is whatever shows through it. Hard corners on purpose: every OS
// applies its own corner mask, and pre-rounding double-rounds on iOS/macOS.
//
// The counter (the knocked-out "x") is transparent in vector form. Where the
// format demands opacity — .ico, apple-touch-icon, the maskable PWA tile — it is
// backed with sparx ink; see ICON_COUNTER_VAR / BRAND.ink.

export const ICON_VIEWBOX = '0 0 160 160' as const;

/** The brand-color field. Fill it; the "x" is the hole left behind. */
export const ICON_FIELD_PATH =
  'M65.05,160L147.43,160L106.24,108.44Z' +
  'M0,0L0,160L24.17,160L84.88,84.03L38.07,21.53L67.49,7.45L100.63,58.71L139.07,7.45L160,7.45L160,0Z' +
  'M160,124.96L160,40.36L127.29,84.03Z';

/** Token backing the knocked-out counter wherever the icon must be opaque.
 *  `--color-secondary` IS sparx ink (#0c1433) — see theme.css. */
export const ICON_COUNTER_VAR = 'var(--color-secondary)' as const;

// ── Wordmark (the "sparx" lockup) ────────────────────────────────────────────
// Drawn from images/new/SVG/logo-{dark,light}.svg (viewBox 0 0 380.55 160). The
// body letters (s p a r) render in `currentColor` so they flip with the
// surrounding ink; the "x" is always the brand spark color.

export const WORDMARK_VIEWBOX = '0 0 400 160' as const;
export const WORDMARK_ASPECT = 400 / 160; // ~2.378:1

/** The "s", "p", "a", "r" body letters — drawn in `currentColor`. */
export const WORDMARK_BODY_PATHS = [
  'M38.58,107.23c-6.46,0-12.22-1.14-17.13-3.72-8.39-4.41-12.41-12.72-14.66-19.27l14.94-.04c1.41,3,3.65,5.36,6.74,7.09,3.09,1.73,6.46,2.6,10.11,2.6,2.9,0,5.31-.65,7.23-1.96,1.92-1.31,2.88-3.14,2.88-5.48,0-2.06-.77-3.74-2.32-5.06-1.55-1.31-4.38-2.62-8.5-3.93l-6.18-1.68c-12.45-3.37-18.59-10.53-18.4-21.49,0-6.08,2.39-10.96,7.16-14.61,4.78-3.65,10.77-5.48,17.98-5.48,10.86,0,18.77,3.98,23.74,11.94l-12.95,5.47c-3.21-3.25-5.73-4.48-11.06-4.48-2.53,0-4.73.59-6.6,1.76-1.87,1.17-2.81,2.79-2.81,4.84,0,1.87.61,3.47,1.83,4.78,1.22,1.31,3.42,2.48,6.6,3.51l7.16,2.11c6.55,1.96,11.47,4.61,14.75,7.93,3.28,3.32,4.92,7.79,4.92,13.41,0,6.65-2.39,11.94-7.16,15.87-4.77,3.93-10.86,5.9-18.26,5.9Z',
  'M95.46,135.17h-15.45V42.08l15.45-6.48v9.41c2.15-3,5.27-5.55,9.34-7.66,4.07-2.11,8.5-3.16,13.27-3.16,9.55,0,17.58,3.56,24.09,10.67,6.51,7.12,9.76,15.73,9.76,25.84s-3.25,18.73-9.76,25.84c-6.51,7.12-14.54,10.67-24.09,10.67-4.77,0-9.2-1.05-13.27-3.16-4.07-2.11-7.19-4.66-9.34-7.66v38.76ZM115.27,93.18c6.08,0,11.09-2.15,15.03-6.46,3.93-4.31,5.9-9.64,5.9-16.01s-1.97-11.7-5.9-16.01c-3.93-4.31-8.94-6.46-15.03-6.46s-11.24,2.15-15.17,6.46c-3.93,4.31-5.9,9.65-5.9,16.01s1.97,11.71,5.9,16.01c3.93,4.31,8.99,6.46,15.17,6.46Z',
  'M196.44,107.23c-9.55,0-17.58-3.56-24.09-10.67-6.51-7.12-9.76-15.73-9.76-25.84s3.25-18.73,9.76-25.84c6.51-7.11,14.54-10.67,24.09-10.67,4.78,0,9.18,1.05,13.2,3.16,4.02,2.11,7.11,4.66,9.27,7.66v-2.93l15.45-6.48v70.22h-15.45v-9.41c-2.15,3-5.24,5.55-9.27,7.66-4.03,2.11-8.43,3.16-13.2,3.16ZM184.23,86.72c3.93,4.31,8.94,6.46,15.03,6.46s11.1-2.15,15.03-6.46c3.93-4.31,5.9-9.64,5.9-16.01s-1.97-11.7-5.9-16.01c-3.93-4.31-8.94-6.46-15.03-6.46s-11.1,2.15-15.03,6.46c-3.93,4.31-5.9,9.65-5.9,16.01s1.97,11.71,5.9,16.01Z',
  'M255.29,105.82v-63.74l15.45-6.48v12.5c1.31-3.93,3.72-7.11,7.23-9.55,3.51-2.43,7.28-3.65,11.31-3.65,2.44,0,4.45.19,6.04.56v15.87c-2.25-.84-4.82-1.26-7.72-1.26-4.68,0-8.66,1.89-11.94,5.69-3.28,3.79-4.92,9.06-4.92,15.8v34.27h-15.45Z',
] as const;

/** The "x" — always the brand spark color, never recolored to match the body. */
export const WORDMARK_X_PATH =
  'M355.71,105.82l-18.96-23.74-18.96,23.74h-18.82l27.95-34.97-21.55-28.77,13.54-6.48,17.7,23.6,17.7-23.6h18.54l-26.4,35.25,27.95,34.97h-18.68Z';

// ── Mascot ("sparky") ────────────────────────────────────────────────────────
// Drawn from images/new/SVG/sparky.svg (viewBox 0 0 380.23 380.23). The body is
// an OUTLINED (hollow) spark stroked in the brand color; the face is a separate
// layer so it can blink + change expression. The eye/mouth coordinates below are
// the delivered artwork's rest pose — the animated face in ./react/spark-mascot
// is tuned around this same lobe centre.

export const MASCOT_VIEWBOX = '0 0 380.23 380.23' as const;
export const MASCOT_STROKE_WIDTH = 28.34 as const;
export const MASCOT_BODY_PATH =
  'M170.31,255.34l-109.82,99.37c-.57.51-1.42-.16-1.05-.83l67.83-124.24c10.46-19.16,6.65-42.98-9.28-57.92L40.35,98.9c-.53-.5,0-1.38.68-1.14l108.59,36.79c16.07,5.44,33.82,1.61,46.21-9.97l105.94-99.04c.56-.52,1.41.13,1.07.8l-62.08,122.72c-10.19,20.14-5.47,44.62,11.46,59.54l105.28,92.71c.58.51,0,1.43-.71,1.14l-136.62-55.85c-16.92-6.92-36.32-3.52-49.87,8.75Z';

/** Rest-pose face anchors from sparky.svg — the mascot component tunes its
 *  expressions around this lobe centre (midpoint of the two eyes). */
export const MASCOT_FACE = {
  eyeLx: 177.89,
  eyeRx: 201.14,
  eyeCy: 176.24,
  eyeRx_: 5.25,
  eyeRy: 9.34,
  /** Lobe centre x — halfway between the eyes. */
  centerX: 189.5,
} as const;
