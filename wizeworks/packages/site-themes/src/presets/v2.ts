// The PLATFORM BASE preset — the v2 defaults a site compiles against when it
// carries no theme of its own.
//
// This used to be `THEME_DEFAULTS_V2`, a six-entry registry keyed by the legacy
// theme names (apex / industrial / drift / market / fleet / drop). Those six were
// the whole theme library before the silica catalog, and they are gone: the
// platform now ships FORTY themes as code (`FIRST_PARTY_THEMES`,
// @wizeworks/silica-catalog), each carrying its own complete palette. A theme that
// brings its own preset does not need a registry to look one up in — so what is
// left here is the ONE fallback, not a shelf.
//
// It mirrors `BASE_SILICA_THEME` (wizeworks/packages/silica-catalog/src/base-theme.ts)
// slot for slot. That agreement is the point: the storefront falls back to
// `BASE_SILICA_THEME` when a site has published no theme, and this compiles the same
// look for the same site through the v2 path. They used to disagree — the fallback
// here was apex's indigo — so an unthemed site rendered one color live and another
// in the compile.
//
// ── WHY THESE PARTICULAR COLORS ─────────────────────────────────────────────
//
// They are silicaui's own house baseline (`quartz`), converted to hex because this
// file's slots are hex by contract. They are deliberately NOT a product's look: the
// fallback is reached by every un-themed site of every brand the platform serves,
// and a default that happens to be one brand's palette paints that brand onto the
// other's tenants. See `base-theme.ts` for the whole reasoning and
// piggles/docs/personas/issues/343 for what it looked like on a live shop.
//
// This package is dependency-free on purpose, so it cannot import the silica
// constant and check itself against it. `v2.test.ts` closes that gap the only way
// available from here: it re-derives every hex below from the upstream OKLCH with
// this package's OWN converter, so a hand-edited value fails.
//
// If the base ever moves again, change it in both (base-theme.css says the same
// about its own copy).

import type { ThemePresetV2 } from '../v2/types';

/** The platform's v2 defaults — silicaui's `quartz` baseline in hex, matching
 *  `BASE_SILICA_THEME`. */
export const PLATFORM_PRESET_V2: ThemePresetV2 = {
  shared: {
    // A system stack, not a product's faces: an un-themed site should load no
    // webfont. `system-ui` is in `BUNDLED_FONTS`, so it never reaches a request.
    fontHeading: 'system-ui',
    fontBody: 'system-ui',
    // silicaui's own radii — the shape `quartz` renders at by declaring none.
    radiusSelector: '1rem',
    radiusField: '0.25rem',
    radiusBox: '0.5rem',
    borderWidth: '1px',
    spaceBase: '0.25rem',
    sizeField: '0.25rem',
    sizeSelector: '0.25rem',
    depth: 1,
    containerWidth: 'medium',
  },
  light: {
    base100: '#f7f9fa',
    base200: '#eceff1',
    base300: '#dbdee2',
    baseContent: '#15191e',
    primary: '#374f6a',
    primaryContent: '#f4f9ff',
    secondary: '#647386',
    secondaryContent: '#f4f9ff',
    accent: '#00a0b9',
    accentContent: '#020d10',
    neutral: '#20242b',
    neutralContent: '#f4f9ff',
    info: '#50a3cb',
    success: '#63b376',
    warning: '#deb866',
    danger: '#cb4644',
    highlight: '#00a0b9',
    highlightContent: '#020d10',
    border: '#dbdee2',
  },
  dark: {
    base100: '#0a0e12',
    base200: '#06080c',
    base300: '#030507',
    baseContent: '#e5e8ec',
    primary: '#8aa8ca',
    primaryContent: '#060c13',
    secondary: '#a9b9ce',
    secondaryContent: '#060c13',
    accent: '#00b9d2',
    accentContent: '#020d10',
    neutral: '#2d333b',
    neutralContent: '#f4f9ff',
    info: '#6db5da',
    success: '#79c289',
    warning: '#e5c379',
    danger: '#ec5b57',
    highlight: '#00b9d2',
    highlightContent: '#020d10',
    border: '#030507',
  },
};
