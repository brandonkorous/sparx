// The platform's fallback token defaults. NOT a theme registry — there isn't one
// here any more.
//
// This file used to export `THEMES` / `THEME_LIST` / `DEFAULT_THEME_KEY`: six
// hand-authored presets (apex, industrial, drift, market, fleet, drop) that were the
// entire theme library before the silica catalog existed. The platform ships FORTY
// themes now, as code, in @wizeworks/silica-catalog — twenty business-named shelves
// plus silicaui's twenty presets. The six were not among them, were not reachable
// from any picker, and matched nothing in the database on any cluster; keeping a
// second, smaller shelf beside the real one is what made "which themes do we have" a
// question with two answers.
//
// What remains is the base a site compiles against when it carries no theme of its
// own. See v2.ts for the v2 half, why it mirrors `BASE_SILICA_THEME`, and why the
// fallback must belong to no product.

import type { CompiledTokens } from '../types';

/** The v1 token defaults every site falls back to — silicaui's `quartz` baseline,
 *  matching `PLATFORM_PRESET_V2` and `BASE_SILICA_THEME`.
 *
 *  The v1 surface is legacy: nothing renders from it. The storefront reads the
 *  silica theme (`wizeworks/apps/site/app/layout.tsx`), and `SiteVersion.compiledTokens` is a
 *  persisted column no reader consults. It stays because the column is required and
 *  transactional email still derives its fallback palette from these keys — which is
 *  the reason it is kept in step rather than left on the old look. */
export const PLATFORM_TOKEN_DEFAULTS: CompiledTokens = {
  light: {
    colorPrimary: '#374f6a',
    colorPrimaryForeground: '#f4f9ff',
    colorAccent: '#00a0b9',
    colorBackground: '#f7f9fa',
    colorForeground: '#15191e',
    colorMuted: '#eceff1',
    colorBorder: '#dbdee2',
    fontHeading: 'system-ui',
    fontBody: 'system-ui',
    radiusBase: '0.5rem',
    containerWidth: 'medium',
  },
  dark: {
    colorPrimary: '#8aa8ca',
    colorPrimaryForeground: '#060c13',
    colorAccent: '#00b9d2',
    colorBackground: '#0a0e12',
    colorForeground: '#e5e8ec',
    colorMuted: '#06080c',
    colorBorder: '#030507',
    fontHeading: 'system-ui',
    fontBody: 'system-ui',
    radiusBase: '0.5rem',
    containerWidth: 'medium',
  },
};

export { PLATFORM_PRESET_V2 } from './v2';
