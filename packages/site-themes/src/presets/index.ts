// The platform's fallback token defaults. NOT a theme registry — there isn't one
// here any more.
//
// This file used to export `THEMES` / `THEME_LIST` / `DEFAULT_THEME_KEY`: six
// hand-authored presets (apex, industrial, drift, market, fleet, drop) that were the
// entire theme library before the silica catalog existed. sparx ships FORTY themes
// now, as code, in @sparx/silica-catalog — twenty business-named shelves plus
// silicaui's twenty presets. The six were not among them, were not reachable from any
// picker, and matched nothing in the database on any cluster; keeping a second,
// smaller shelf beside the real one is what made "which themes do we have" a question
// with two answers.
//
// What remains is the base a site compiles against when it carries no theme of its
// own. See v2.ts for the v2 half and why it mirrors `BASE_SILICA_THEME`.

import type { CompiledTokens } from '../types';

/** The v1 token defaults every site falls back to — the sparx Ember base, matching
 *  `PLATFORM_PRESET_V2` and `BASE_SILICA_THEME`.
 *
 *  The v1 surface is legacy: nothing renders from it. The storefront reads the
 *  silica theme (`apps/site/app/layout.tsx`), and `SiteVersion.compiledTokens` is a
 *  persisted column no reader consults. It stays because the column is required and
 *  transactional email still derives its fallback palette from these keys. */
export const PLATFORM_TOKEN_DEFAULTS: CompiledTokens = {
  light: {
    colorPrimary: '#e04631',
    colorPrimaryForeground: '#ffffff',
    colorAccent: '#c1652e',
    colorBackground: '#ffffff',
    colorForeground: '#0f172a',
    colorMuted: '#f8fafc',
    colorBorder: '#e2e8f0',
    fontHeading: 'Space Grotesk',
    fontBody: 'Inter',
    radiusBase: '0.5rem',
    containerWidth: 'medium',
  },
  dark: {
    colorPrimary: '#f2604b',
    colorPrimaryForeground: '#ffffff',
    colorAccent: '#c1652e',
    colorBackground: '#0b1120',
    colorForeground: '#e2e8f0',
    colorMuted: '#111827',
    colorBorder: '#1f2937',
    fontHeading: 'Space Grotesk',
    fontBody: 'Inter',
    radiusBase: '0.5rem',
    containerWidth: 'medium',
  },
};

export { PLATFORM_PRESET_V2 } from './v2';
