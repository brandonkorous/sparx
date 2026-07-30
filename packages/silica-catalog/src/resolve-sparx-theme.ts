// resolveSparxTheme — turn a raw sparx `Theme` (a `SPARX_THEMES` entry from
// defineTheme, or any authored silica theme) into the FULL token bag a site ships
// as its `site.theme`, matching the shape the storefront + email utilities read.
//
// A raw silica `Theme` states colors/shape/fonts but leaves the auto `-content`
// pairs and a handful of sparx-only residuals to be derived at render. A shipped
// `site.theme` (and the golden template's captured one) is FLAT — every var the
// utilities reference is present as a concrete value, because
// `buildSilicaThemeCssFromTheme` emits `theme.tokens` verbatim with no derivation.
// This bridges the two: silica's OWN `resolveThemeTokens` (the same AA-contrast
// engine the canvas + publishing use) fills every `--color-<role>-content`, then we
// add the residuals silica's standard set doesn't model but sparx pages/emails use:
//
//   · --color-danger(+content)   mirror of silica's `error` (sparx `statusTone()`
//                                emits `danger`; silica components use `error`).
//   · --color-highlight(+content) mirror of `accent` (sparx's promo/attention hue;
//                                keeps bg-highlight / badge-highlight on-theme).
//   · --color-border             the surface ramp's base-300 — a hairline that
//                                tracks the theme instead of a fixed grey.
//   · --border / --container-max / --font-heading  the three residuals
//                                `@sparx/site-themes` documents silica doesn't token.
//
// So one `SPARX_THEME` drops into a blueprint bundle (or a live site) rendering
// identically to how the theme picker previews it.

import { resolveThemeTokens, type Theme } from '@wizeworks/silicaui-html';

/** The container max every sparx site ships (1152px), matching the golden template. */
const CONTAINER_MAX = '72rem';

/** danger←error, highlight←accent, border←base-300 — the color residuals silica's
 *  role set lacks, derived from roles it DOES resolve so they stay on-theme + AA. */
function colorResiduals(bag: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  const error = bag['--color-error'];
  const errorContent = bag['--color-error-content'];
  const accent = bag['--color-accent'];
  const accentContent = bag['--color-accent-content'];
  const base300 = bag['--color-base-300'];
  if (error) out['--color-danger'] = error;
  if (errorContent) out['--color-danger-content'] = errorContent;
  if (accent) out['--color-highlight'] = accent;
  if (accentContent) out['--color-highlight-content'] = accentContent;
  if (base300) out['--color-border'] = base300;
  return out;
}

/** Keep only `--color-*` — the dark delta carries color deltas, never shape/type
 *  (those are mode-independent and live once in `tokens`; `themes.test.ts` enforces
 *  it, and `resolveThemeTokens` re-emits them for both modes). */
function colorOnly(bag: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(bag).filter(([k]) => k.startsWith('--color-')));
}

/**
 * A raw sparx `Theme` → the flat, ship-ready `site.theme`: silica's resolved tokens
 * (colors + AA `-content` pairs, radii, depth, `--font-sans`/`--font-head`) plus the
 * sparx residuals. Light in `tokens`, the color delta in `dark`.
 */
export function resolveSparxTheme(theme: Theme): Theme {
  const light = resolveThemeTokens(theme, 'light');
  const dark = resolveThemeTokens(theme, 'dark');
  const headStack = light['--font-head'] ?? light['--font-sans'] ?? '';
  return {
    name: theme.name,
    mode: 'light',
    tokens: {
      ...light,
      ...colorResiduals(light),
      // Line WIDTH: carry the theme's own if it set one, else the platform 1px.
      '--border': theme.tokens['--border'] ?? '1px',
      '--container-max': CONTAINER_MAX,
      // sparx app-chrome h1..h6 read `--font-heading`; silica's own is `--font-head`.
      // Emit both so either resolves to the theme's heading face.
      '--font-heading': headStack,
    },
    dark: {
      ...colorOnly(dark),
      ...colorResiduals(dark),
    },
  };
}
