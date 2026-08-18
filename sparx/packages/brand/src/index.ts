// @sparx/brand — the sparx brand as a silicaui theme.
//
// The palette + layer order live in the sibling CSS files, imported by each app's
// globals.css (`@import '@sparx/brand/theme.css'` / `'@sparx/brand/layers.css'`).
// This module exports the theme-name constants + the brand MARK geometry/colors
// (./marks) so app layouts, a future theme toggle, and the edge OG generators
// reference them in one place instead of stringly-typing them. The React brand
// components (Wordmark, Spark, SparkMascot) live at `@sparx/brand/react`.

export * from './marks';

/** The `data-theme` value set on `<html>` for the light sparx brand. */
export const SPARX_THEME = 'sparx' as const;

/** The `data-theme` value for the dark sparx brand (nested islands or a toggle). */
export const SPARX_THEME_DARK = 'sparx-dark' as const;

/** Every semantic color registered on the silicaui plugin (`colors:` list) that
 *  carries the sparx brand. `danger` is the sparx-specific N-th color beyond
 *  silicaui's defaults, paired with `--color-danger` in theme.css — it backs the
 *  `statusTone()` vocabulary. Keep in sync with each app's `@plugin '@wizeworks/silicaui'`. */
export const SPARX_PLUGIN_COLORS = [
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

export type SparxTheme = typeof SPARX_THEME | typeof SPARX_THEME_DARK;
export type SparxPluginColor = (typeof SPARX_PLUGIN_COLORS)[number];

/** Every module (and platform surface) that owns a brand hue. Each name has a
 *  `--color-module-<name>` + `--color-module-<name>-content` pair in theme.css;
 *  `ModuleProvider` aliases the active subtree's `--module-active` / `-content`
 *  role vars at that pair, and tints come from silicaui's universal `soft`
 *  treatment on the solid (no pre-baked tint token). `storefront` is the legacy
 *  Site Builder identity; `platform` is the neutral default. Keep in sync with
 *  theme.css. */
export const SPARX_MODULES = [
  'storefront',
  'builder',
  'commerce',
  'cms',
  'crm',
  'email',
  'b2b',
  'invoicing',
  'ai',
  'dropship',
  'inventory',
  'chat',
  'scheduling',
  'automations',
  'seo',
  'finance',
  'staff',
  'partner',
  'platform',
] as const;

export type SparxModule = (typeof SPARX_MODULES)[number];
