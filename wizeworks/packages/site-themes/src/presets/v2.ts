// The PLATFORM BASE preset — the v2 defaults a site compiles against when it
// carries no theme of its own.
//
// This used to be `THEME_DEFAULTS_V2`, a six-entry registry keyed by the legacy
// theme names (apex / industrial / drift / market / fleet / drop). Those six were
// the whole theme library before the silica catalog, and they are gone: sparx now
// ships FORTY themes as code (`FIRST_PARTY_THEMES`, @wizeworks/silica-catalog), each
// carrying its own complete palette. A theme that brings its own preset does not
// need a registry to look one up in — so what is left here is the ONE fallback,
// not a shelf.
//
// It is the sparx Ember look, mirroring `BASE_SILICA_THEME`
// (wizeworks/packages/silica-catalog/src/base-theme.ts) slot for slot. That agreement is the
// point: the storefront falls back to `BASE_SILICA_THEME` when a site has published
// no theme, and this compiles the same look for the same site through the v2 path.
// They used to disagree — the fallback here was apex's indigo — so an unthemed site
// rendered Ember live and indigo in the compile. If the Ember base ever changes,
// change it in both (base-theme.css says the same about its own copy).

import type { ThemePresetV2 } from '../v2/types';

/** The platform's v2 defaults — sparx Ember, matching `BASE_SILICA_THEME`. */
export const PLATFORM_PRESET_V2: ThemePresetV2 = {
  shared: {
    fontHeading: 'Space Grotesk',
    fontBody: 'Inter',
    radiusSelector: '9999px',
    radiusField: '0.375rem',
    radiusBox: '0.5rem',
    borderWidth: '1px',
    spaceBase: '0.25rem',
    sizeField: '0.25rem',
    sizeSelector: '0.25rem',
    depth: 1,
    containerWidth: 'medium',
  },
  light: {
    base100: '#ffffff',
    base200: '#f8fafc',
    base300: '#eef2f7',
    baseContent: '#0f172a',
    primary: '#e04631',
    primaryContent: '#ffffff',
    secondary: '#4c9a8e',
    secondaryContent: '#ffffff',
    accent: '#c1652e',
    accentContent: '#fff7ef',
    neutral: '#0f172a',
    neutralContent: '#ffffff',
    info: '#0284c7',
    success: '#16a34a',
    warning: '#d97706',
    danger: '#dc2626',
    highlight: '#ec4899',
    highlightContent: '#ffffff',
    border: '#e2e8f0',
  },
  dark: {
    base100: '#0b1120',
    base200: '#111827',
    base300: '#1b2538',
    baseContent: '#e2e8f0',
    primary: '#f2604b',
    primaryContent: '#ffffff',
    secondary: '#4c9a8e',
    secondaryContent: '#ffffff',
    accent: '#c1652e',
    accentContent: '#fff7ef',
    neutral: '#e2e8f0',
    neutralContent: '#0a0a0a',
    info: '#38bdf8',
    success: '#4ade80',
    warning: '#fbbf24',
    danger: '#f87171',
    highlight: '#ec4899',
    highlightContent: '#0a0a0a',
    border: '#1f2937',
  },
};
