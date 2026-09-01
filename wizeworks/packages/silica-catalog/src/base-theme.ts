// BASE_SILICA_THEME — the look a tenant site wears when nothing else is known.
//
// Every site resolves to a concrete `site.theme` (docs/implementation
// perfect-template + the theming-spine plan) — the storefront renders it verbatim
// and transactional email derives from it. This constant is the floor under that:
// what a site wears in the pre-install window, or when a render cannot read the
// published one.
//
// ── WHY IT BELONGS TO NOBODY ────────────────────────────────────────────────
//
// It used to be one product's flagship look — `name: 'sparx'`, an Ember primary,
// copied verbatim from the golden template. That was a reasonable default while
// the platform served one brand and a straightforwardly wrong one afterwards:
// `wizeworks/apps/site` serves every brand's tenants off one deployment, so the
// fallback painted one company's brand color onto the other company's tenants'
// public shops. A shopper met a business whose site did not match itself, with no
// error anywhere to explain it (piggles/docs/personas/issues/343).
//
// The same failure had already been diagnosed one layer over, for the colors a
// PLATFORM email paints itself in, and `@wizeworks/brand-core`'s email palette
// states the rule this file now follows:
//
//   > A brand-blind fallback that happens to be one brand's palette is the same
//   > bug wearing a default, and it is worse than an obvious one because it
//   > renders perfectly.
//
// So the floor is silicaui's OWN house baseline, `quartz`: the preset that states
// no type and no shape, one cool-mineral family (Chalk/Flint/Slate/Obsidian) for
// structure and a single reserved accent for interaction. It belongs to no
// product, it is maintained upstream, and every role in it clears WCAG AA — which
// the Ember base did not (its primary and accent pairs sat at 4.13:1 and 3.83:1,
// carried as a documented exception because they were the shipped brand).
//
// ── THIS IS NOT WHERE A BRAND'S STARTER LOOK LIVES ──────────────────────────
//
// A tenant does not normally reach this bag at all. Each brand ships a starter
// site — `platformBrandIdentity(brand).goldenBlueprintKey` — whose bundle carries
// its own complete theme, installed onto the primary property at sign-up. That is
// where a brand states the look its businesses begin with, and it stays correct
// per brand precisely because it is the BRAND's artifact rather than the
// platform's. Nothing here should ever be tuned to make one brand's sites look
// right; fix that brand's starter bundle instead.
//
// ── HOW THE VALUES ARE KEPT HONEST ──────────────────────────────────────────
//
// Written out rather than computed, because `base-theme.css` has to hold the same
// values as literals for Tailwind to read at build time, and a literal checked
// against a literal is the arrangement this file already had. Two tests hold the
// three copies together, and both name the exact key that drifted:
//
//   · `base-theme.test.ts`     — this bag against silicaui's own `quartz` preset,
//                                so an upstream palette change is loud rather than
//                                silently ignored.
//   · `base-theme.css.test.ts` — `base-theme.css` against this bag.
//
// The three roles silicaui's own set does not model (`danger`, `highlight`,
// `border`) are derived here exactly as `resolveSparxTheme` derives them for every
// shipped theme: danger←error, highlight←accent, border←base-300. Nothing in this
// file invents a color.

import type { Theme } from '@wizeworks/silicaui-html';

/** silicaui's own default face stack — a system stack, so an unthemed site loads
 *  no webfont at all. `ui-sans-serif` is in `BUNDLED_FONTS`, so it never reaches a
 *  Google Fonts request. */
const SYSTEM_SANS =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export const BASE_SILICA_THEME: Theme = {
  name: 'quartz',
  mode: 'light',
  tokens: {
    '--depth': '1',
    '--border': '1px',
    '--font-sans': SYSTEM_SANS,
    // App chrome reads `--font-heading`; silica's own token is `--font-head`. With
    // no distinct heading face, headings take the body stack, which is silica's
    // own behavior for a theme that names none.
    '--font-heading': SYSTEM_SANS,
    // silicaui's own radii — the shape `quartz` renders at by declaring none.
    '--radius-box': '0.5rem',
    '--radius-field': '0.25rem',
    '--radius-selector': '1rem',
    '--size-field': '0.25rem',
    // Not a silica token: the platform's own page width (1152px).
    '--container-max': '72rem',
    '--color-base-100': 'oklch(98% 0.003 250)',
    '--color-base-200': 'oklch(95% 0.004 250)',
    '--color-base-300': 'oklch(90% 0.006 250)',
    '--color-base-content': 'oklch(21% 0.012 255)',
    '--color-primary': 'oklch(42% 0.055 252)',
    '--color-primary-content': 'oklch(98% 0.01 252)',
    '--color-secondary': 'oklch(55% 0.035 255)',
    '--color-secondary-content': 'oklch(98% 0.01 255)',
    '--color-accent': 'oklch(64% 0.13 211)',
    '--color-accent-content': 'oklch(15% 0.02 211)',
    '--color-neutral': 'oklch(26% 0.014 255)',
    '--color-neutral-content': 'oklch(98% 0.01 255)',
    '--color-info': 'oklch(68% 0.1 232)',
    '--color-info-content': 'oklch(15% 0.02 232)',
    '--color-success': 'oklch(70% 0.12 150)',
    '--color-success-content': 'oklch(15% 0.02 150)',
    '--color-warning': 'oklch(80% 0.11 85)',
    '--color-warning-content': 'oklch(15% 0.02 85)',
    '--color-error': 'oklch(58% 0.17 25)',
    '--color-error-content': 'oklch(100% 0 0)',
    '--color-danger': 'oklch(58% 0.17 25)',
    '--color-danger-content': 'oklch(100% 0 0)',
    '--color-highlight': 'oklch(64% 0.13 211)',
    '--color-highlight-content': 'oklch(15% 0.02 211)',
    '--color-border': 'oklch(90% 0.006 250)',
  },
  dark: {
    '--color-base-100': 'oklch(16% 0.01 255)',
    '--color-base-200': 'oklch(13.5% 0.01 255)',
    '--color-base-300': 'oklch(11% 0.01 255)',
    '--color-base-content': 'oklch(93% 0.006 250)',
    '--color-primary': 'oklch(72% 0.06 252)',
    '--color-primary-content': 'oklch(15% 0.02 252)',
    '--color-secondary': 'oklch(78% 0.035 255)',
    '--color-secondary-content': 'oklch(15% 0.02 255)',
    '--color-accent': 'oklch(72% 0.13 211)',
    '--color-accent-content': 'oklch(15% 0.02 211)',
    '--color-neutral': 'oklch(32% 0.016 255)',
    '--color-neutral-content': 'oklch(98% 0.01 255)',
    '--color-info': 'oklch(74% 0.09 232)',
    '--color-info-content': 'oklch(15% 0.02 232)',
    '--color-success': 'oklch(75% 0.11 150)',
    '--color-success-content': 'oklch(15% 0.02 150)',
    '--color-warning': 'oklch(83% 0.1 85)',
    '--color-warning-content': 'oklch(15% 0.02 85)',
    '--color-error': 'oklch(66% 0.18 25)',
    '--color-error-content': 'oklch(15% 0.02 25)',
    '--color-danger': 'oklch(66% 0.18 25)',
    '--color-danger-content': 'oklch(15% 0.02 25)',
    '--color-highlight': 'oklch(72% 0.13 211)',
    '--color-highlight-content': 'oklch(15% 0.02 211)',
    '--color-border': 'oklch(11% 0.01 255)',
  },
};
