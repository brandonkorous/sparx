// Token Model v2 → silica-NATIVE CSS custom properties (docs/118 §1.0 north star).
//
// The replacement for `buildThemeCssV2` (which emits the `--st-*` vocabulary +
// legacy aliases). Under the engine-adoption plan a tenant site is just "the
// silica packages + one static app sheet + a per-tenant theme file" — and THIS
// is that theme file: silicaui's OWN token names, so every generated silica class
// (`.btn-primary`, `.bg-base-200`, `.badge-danger`, `rounded-box`, …) resolves
// against the tenant's values with NO translation layer and NO per-tenant CSS
// compile. `@sparx/brand/theme.css` proves the shape for the dashboard; this
// emits the same vocabulary from a compiled tenant theme.
//
// sparx's v2 model is richer than silica's standard set, so the mapping is:
//   · the standard slots (base ramp, primary/secondary/accent/neutral, the four
//     status colors, radii, body font, control height, depth) map 1:1;
//   · `danger` emits BOTH `--color-danger` AND `--color-error` from one value, so
//     sparx's `statusTone()` (danger) and silica's built-ins (error) both resolve;
//   · the handful silica genuinely doesn't model stays as a SMALL residual —
//     `--font-heading`, `--container-max`, `--color-highlight`, `--color-border`.
//   · v2's derived space scale, text tiers, and depth-scaled shadow set DISSOLVE:
//     spacing is silica/Tailwind's own fixed scale, tinting is `soft`, and shadow
//     intensity rides silica's `--depth`. That deletion IS the "no other
//     complexity" the north star asks for — it is not carried here.

import type { CompiledColorTokensV2, CompiledThemeV2, SharedTokensV2 } from './types';

// Named container widths → the CSS length they compile to (a raw length passes
// through unchanged).
const CONTAINER_WIDTHS: Record<string, string> = {
  narrow: '52rem',
  medium: '72rem',
  wide: '90rem',
  full: '100%',
};

const FONT_FALLBACK = 'system-ui, -apple-system, sans-serif';

function fontStack(name: string): string {
  return `'${name.replace(/'/g, '')}', ${FONT_FALLBACK}`;
}

function containerLength(width: string): string {
  return CONTAINER_WIDTHS[width] ?? width;
}

/** Per-mode color vars in silicaui's standard `--color-*` vocabulary (base ramp +
 *  every semantic pair). `danger` doubles as `error`; `highlight` + `border` are
 *  the sparx residuals silica's standard palette lacks. */
export function silicaColorVars(c: CompiledColorTokensV2): Record<string, string> {
  return {
    '--color-base-100': c.base100,
    '--color-base-200': c.base200,
    '--color-base-300': c.base300,
    '--color-base-content': c.baseContent,
    '--color-primary': c.primary,
    '--color-primary-content': c.primaryContent,
    '--color-secondary': c.secondary,
    '--color-secondary-content': c.secondaryContent,
    '--color-accent': c.accent,
    '--color-accent-content': c.accentContent,
    '--color-neutral': c.neutral,
    '--color-neutral-content': c.neutralContent,
    '--color-info': c.info,
    '--color-info-content': c.infoContent,
    '--color-success': c.success,
    '--color-success-content': c.successContent,
    '--color-warning': c.warning,
    '--color-warning-content': c.warningContent,
    // sparx `statusTone()` emits `danger`; silica's built-in components use
    // `error`. Emit both from the one danger value so either name resolves
    // (mirrors @sparx/brand/theme.css, which registers both).
    '--color-danger': c.danger,
    '--color-danger-content': c.dangerContent,
    '--color-error': c.danger,
    '--color-error-content': c.dangerContent,
    // highlight — sparx's N-th promo/attention color (registered in the site's
    // `@plugin { colors }` list so `bg-highlight` / `badge-highlight` generate).
    '--color-highlight': c.highlight,
    '--color-highlight-content': c.highlightContent,
    // border COLOR — silica models line WIDTH (`--border`), not a line hue; sparx
    // sites read an explicit border color, so keep this one residual color var.
    '--color-border': c.border,
  };
}

/** Shared (mode-independent) vars: silica shape + type + control + depth tokens,
 *  plus the two residuals silica doesn't token (heading font, container max). */
export function silicaSharedVars(s: SharedTokensV2): Record<string, string> {
  return {
    // Shape → silica radius tokens (rounded-selector / -field / -box read these).
    '--radius-selector': s.radiusSelector,
    '--radius-field': s.radiusField,
    '--radius-box': s.radiusBox,
    // Line weight → silica's `--border` (its universal border-width token).
    '--border': s.borderWidth,
    // Control height → silica's `--size-field`.
    '--size-field': s.sizeField,
    // Shadow intensity → silica's `--depth` (its shadow utilities scale with it),
    // replacing v2's hand-derived `--st-shadow-*` set.
    '--depth': String(s.depth),
    // Body copy → silica's `--font-sans`.
    '--font-sans': fontStack(s.fontBody),
    // ── Residuals silica's standard token set doesn't model ──────────────────
    '--font-heading': fontStack(s.fontHeading),
    '--container-max': containerLength(s.containerWidth),
  };
}

/** Merged shared + one mode's colors — for a single `:root` injection when dark
 *  mode isn't split out. */
export function compiledToSilicaVars(
  compiled: CompiledThemeV2,
  mode: 'light' | 'dark'
): Record<string, string> {
  return { ...silicaSharedVars(compiled.shared), ...silicaColorVars(compiled[mode]) };
}

/** Structural silica `Theme` (silicaui-html) — reproduced here so this package
 *  stays free of a silicaui-html dependency (same rationale as the theme-file
 *  emitter above). The consumer (the dashboard `<Builder document.theme>`) types
 *  the return as the real `Theme`; the shape is identical. */
export interface SilicaTheme {
  /** The `[data-theme]` value applied to the canvas/site root. */
  name: string;
  /** Base (light) tokens — `--color-*`, `--radius-*`, `--size-field`, `--depth`,
   *  `--font-sans`, plus the sparx residuals (`--font-heading`, `--container-max`). */
  tokens: Record<string, string>;
  /** Dark-mode color deltas (shared shape tokens don't change per mode). */
  dark?: Record<string, string>;
  mode?: 'light' | 'dark';
}

/** Lower a compiled tenant theme to a silica `Theme` object — the shape
 *  `<Builder document.theme>` and `resolveTree`/`renderPage` read. Shared (shape/
 *  type/depth) + light colors seed `tokens`; the dark color ramp is the `dark`
 *  delta, exactly like `buildSilicaThemeCss`'s `:root` / `[data-theme="dark"]`
 *  split — one theme, two projections (a live `Theme` object here, a static
 *  stylesheet there). */
export function compiledToSilicaTheme(compiled: CompiledThemeV2, name = 'tenant'): SilicaTheme {
  return {
    name,
    mode: 'light',
    tokens: { ...silicaSharedVars(compiled.shared), ...silicaColorVars(compiled.light) },
    dark: silicaColorVars(compiled.dark),
  };
}

function declBlock(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join('');
}

export interface BuildSilicaThemeCssOptions {
  /** Selector for the light/shared block. Default `:root`. */
  rootSelector?: string;
}

/**
 * Build the tenant theme stylesheet in silica's native vocabulary: shared + light
 * at `:root`, dark colors under an explicit `[data-theme="dark"]` opt-in AND the
 * system preference (unless the user forced light). Shared vars emit once. This is
 * the ENTIRE per-tenant style payload the north star ships — no compiled utilities,
 * just token values the static silica app sheet reads.
 */
export function buildSilicaThemeCss(
  compiled: CompiledThemeV2,
  opts: BuildSilicaThemeCssOptions = {}
): string {
  const root = opts.rootSelector ?? ':root';
  const light = declBlock({
    ...silicaSharedVars(compiled.shared),
    ...silicaColorVars(compiled.light),
  });
  const dark = declBlock(silicaColorVars(compiled.dark));
  return [
    `${root}{${light}}`,
    `${root}[data-theme="dark"]{${dark}}`,
    `@media (prefers-color-scheme:dark){${root}:not([data-theme="light"]){${dark}}}`,
  ].join('');
}

/**
 * Build the tenant theme stylesheet from an AUTHORED silica `Theme` — the theme the
 * builder round-trips through `onChange` (docs/118). A silica `Theme`'s `tokens` /
 * `dark` maps are ALREADY the `--*` custom properties this stylesheet declares, so
 * this is a direct projection: no inverse token mapping, nothing lost, and an author
 * edit renders on the storefront exactly as it previewed on the canvas.
 *
 * This is the counterpart to `buildSilicaThemeCss` (which projects a brand-DERIVED
 * `CompiledThemeV2`). A property that has never had its theme edited in the builder
 * renders through that one; once an author saves a theme, the stored `Theme` wins
 * and renders through this one. Same selectors, same dark-mode rules, so switching
 * between them is invisible.
 */
export function buildSilicaThemeCssFromTheme(
  theme: SilicaTheme,
  opts: BuildSilicaThemeCssOptions = {}
): string {
  const root = opts.rootSelector ?? ':root';
  const out = [`${root}{${declBlock(theme.tokens)}}`];
  if (theme.dark && Object.keys(theme.dark).length > 0) {
    const dark = declBlock(theme.dark);
    out.push(`${root}[data-theme="dark"]{${dark}}`);
    out.push(`@media (prefers-color-scheme:dark){${root}:not([data-theme="light"]){${dark}}}`);
  }
  return out.join('');
}
