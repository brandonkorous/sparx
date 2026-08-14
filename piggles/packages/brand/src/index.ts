// @piggles/brand — the Piggles brand as a silicaui theme.
//
// Visual identity ONLY: theme names, the registered color list, and the app →
// group taxonomy the palette is built on. Terminology ("App", not "module";
// "Business", not "tenant") is a separate adapter and does not belong here — see
// piggles/CLAUDE.md.
//
// The palette itself lives in the sibling ./theme.css, imported by each Piggles
// app's globals.css (`@import '@piggles/brand/theme.css'`, after
// './layers.css'). Live UI should read the CSS variables so light/dark and the
// active-app hue flow automatically; these constants exist for the contexts where
// custom properties genuinely don't resolve — satori/`ImageResponse` OG routes,
// raster favicons, canvas.

export * from './marks';

/** The `data-theme` value for the light Piggles brand.
 *
 *  Deliberately the BARE name. sparx aliases its blocks to `light` too, but
 *  `@sparx/brand/theme.css` is imported only by the four sparx apps and never by
 *  a shared package — so inside a Piggles app, `light` IS the Piggles brand and
 *  there is nothing to collide with. See the header of ./theme.css. */
export const PIGGLES_THEME = 'light' as const;

/** The `data-theme` value for the dark Piggles brand. */
export const PIGGLES_THEME_DARK = 'dark' as const;

export type PigglesTheme = typeof PIGGLES_THEME | typeof PIGGLES_THEME_DARK;

/** The user-facing appearance preference. `system` resolves to one of the two
 *  themes above from `prefers-color-scheme`; the resolved value is what gets
 *  written to `data-theme`. */
export const PIGGLES_APPEARANCE = ['system', 'light', 'dark'] as const;

export type PigglesAppearance = (typeof PIGGLES_APPEARANCE)[number];

/** Every semantic color registered on the silicaui plugin. Identical in NAME to
 *  sparx's list — the values differ, the vocabulary does not, so shared surfaces
 *  keep resolving `color="danger"` under either brand.
 *
 *  This list REPLACES silicaui's default set wherever it is used in a `@plugin`
 *  block, so every built-in that is still wanted has to appear here — `neutral`
 *  included. `danger` is the ninth: `statusTone()` returns it, and omitting it
 *  renders `.badge-danger` colorless on every shared surface. */
export const PIGGLES_PLUGIN_COLORS = [
  'primary',
  'secondary',
  'accent',
  'neutral',
  'info',
  'success',
  'warning',
  'error',
  'danger',
] as const;

export type PigglesPluginColor = (typeof PIGGLES_PLUGIN_COLORS)[number];

/** The app groups. Piggles colors the GROUP, not the app — see the header of
 *  theme.css for why (an 18-hue wheel does not stay distinguishable once the rose
 *  family is reserved for the brand).
 *
 *  This package owns what a group LOOKS LIKE. It does not own which apps are in
 *  one — that is product structure and lives in `@piggles/config`, derived from
 *  the app registry so the two can never disagree. theme.css restates the
 *  membership in CSS only because a stylesheet cannot import TypeScript. */
export const PIGGLES_GROUPS = ['home', 'web', 'sell', 'people', 'money', 'run'] as const;

export type PigglesGroup = (typeof PIGGLES_GROUPS)[number];

/** Group hexes, mirroring the `--color-group-*` tokens in theme.css. CONSTANT
 *  across light and dark — a group's hue is its identity, not a themed surface.
 *  `home` is absent on purpose: it aliases the brand pink, which DOES differ by
 *  theme, so it must be read from the token rather than copied here.
 *
 *  Do NOT read this from live UI: use the tokens so theming flows. It exists for
 *  satori/OG routes and rasterised icons, where custom properties don't resolve. */
export const GROUP_HEX: Record<Exclude<PigglesGroup, 'home'>, string> = {
  web: '#4F46E5',
  sell: '#C2410C',
  people: '#0E7490',
  money: '#4D7C0F',
  run: '#7E22CE',
};

/** Brand hexes, kept in sync with `[data-theme='light']` / `[data-theme='dark']`
 *  and with the approved identity board at docs/initial/config/brand.tokens.json. */
export const BRAND = {
  /** Piggles Pink — the mark, and the brand's one accent. */
  primary: '#FF6F86',
  /** Foreground on `primary`. The brand INK, not white: white measures 2.44:1. */
  primaryContent: '#202631',
  /** Piggles Pink tuned for dark surfaces. */
  primaryDark: '#FF7C91',
  /** Soft supporting pink — the `accent` role in light. */
  accentSoft: '#FFB3C0',
  /** Palest support pink — washes and empty-state fills. */
  accentPale: '#FFE9ED',
  /** Piggles ink — the wordmark charcoal, and body text. */
  ink: '#202631',
  /** Foreground on `ink`. */
  inkContent: '#FFFFFF',
  /** The warm off-white canvas that distinguishes Piggles from sparx's cool grey. */
  surfaceWarm: '#FBF7F8',
  paper: '#FFFFFF',
} as const;
