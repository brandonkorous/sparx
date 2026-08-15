// The brand → silica `Theme` derivation, re-exported from where it now lives.
//
// It used to be implemented here, which was fine while the canvas was its only
// caller. It stopped being fine the moment the pre-publish check needed the same
// answer: a site's theme is `null` in the database until an author edits it, so
// "what does `bg-primary` actually paint on this site" is only answerable by
// compiling the brand — and a check that compiled it differently from the canvas
// would be judging colours nobody sees.
//
// So the derivation moved to `@sparx/site-themes/v2/brand-theme.ts`, next to the
// compiler it calls, and both callers read the one copy. This file stays as the
// import path the studio already uses, and to keep the studio's `Theme` (silicaui's
// nominal type) lined up with the structural `SilicaTheme` the package returns.

import {
  storedPresetV2,
  tenantTheme as compileTenantTheme,
  type BrandColumns,
} from '@sparx/site-themes';
import type { Theme } from '@wizeworks/silicaui-html';

export { applyBrandOverride, EMPTY_BRAND } from '@sparx/site-themes';
export type { BrandColumns, BrandOverride } from '@sparx/site-themes';

/** Compile the site's theme + the tenant's (effective) brand into a silica `Theme`,
 *  so the canvas opens on the real look — colours, type, rounding. `undefined` on any
 *  failure, so the caller falls through to a preset rather than crashing.
 *
 *  `themePreset` is the site's stored theme blob (`SiteConfig.draftSettings`); the
 *  brand layers OVER it. Passing none compiles the platform base, which is what the
 *  canvas used to do unconditionally — so a site on `clinic` opened the editor in
 *  Ember and the author edited against colours their visitors never see. */
export function tenantTheme(
  brand: BrandColumns,
  config: { themeKey: string; themePreset?: unknown; presentation?: unknown }
): Theme | undefined {
  return compileTenantTheme(brand, {
    themeKey: config.themeKey,
    preset: storedPresetV2(config.themePreset),
    presentation: config.presentation,
  });
}
