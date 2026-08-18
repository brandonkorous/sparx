// The canonical storefront token surface — the DATA model only.
//
// A "theme token" is a logical design value (a color, a font, a radius) that every
// theme provides for both light and dark. These keys are what a published
// `SiteVersion.compiledTokens` stores and what the public site-snapshot API returns,
// so they are a persisted contract, not a styling detail.
//
// They no longer bind to CSS. `TOKEN_CSS_VARS` / `tokensToCssVars` / `tokensToCss`
// used to project each key onto `--st-*` custom properties (and dual-write a
// `--color-*` twin), which is precisely what gave tenant color two sources of truth
// on the storefront — see docs/implementation/st-token-retirement.md. Rendering now
// goes through the v2 engine's silica emitter (`v2/silica-css.ts`), which speaks
// silicaui's own `--color-*` vocabulary. Do not add a CSS projection back here.
//
// A subset of tokens maps 1:1 onto the commerce-owned `CommerceSiteTheme`
// columns; publishing write-throughs that subset (see SITE_THEME_WRITETHROUGH
// in compile.ts).

export type ThemeTokenKey =
  | 'colorPrimary'
  | 'colorPrimaryForeground'
  | 'colorAccent'
  | 'colorBackground'
  | 'colorForeground'
  | 'colorMuted'
  | 'colorBorder'
  | 'fontHeading'
  | 'fontBody'
  | 'radiusBase'
  | 'containerWidth';

export type ThemeTokens = Record<ThemeTokenKey, string>;

export const TOKEN_KEYS: readonly ThemeTokenKey[] = [
  'colorPrimary',
  'colorPrimaryForeground',
  'colorAccent',
  'colorBackground',
  'colorForeground',
  'colorMuted',
  'colorBorder',
  'fontHeading',
  'fontBody',
  'radiusBase',
  'containerWidth',
] as const;

// Named container widths → the CSS max-width they compile to.
export const CONTAINER_WIDTHS: Record<string, string> = {
  narrow: '52rem',
  medium: '72rem',
  wide: '90rem',
  full: '100%',
};
