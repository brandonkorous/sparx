// The tenant's brand → the silica `Theme` everything renders against, and the
// per-site override that decides WHICH brand a non-primary site uses.
//
// WHY THIS IS SHARED RATHER THAN LIVING IN THE EDITOR. A site's theme is `null` in the
// database until an author edits it in the Design inspector — which most never do. Up
// to that point the site is rendered from the tenant's BRAND, compiled. So "what colour
// is this site's primary?" has no answer in any stored column; it has an answer only
// through this function, and every surface that needs one has to call the same one.
// The builder canvas needs it to open on the real brand. The pre-publish contrast check
// needs it to know what a `bg-primary` actually paints. A second copy of the derivation
// would eventually disagree, and the failure mode is a check that judges a colour the
// visitor never sees.
//
// Every step degrades gracefully — a failed compile returns undefined so the caller
// falls through to a preset — because a brand hiccup must never take the editor down,
// and must never turn a check into an error page.

import { compileThemeForTenant } from './tenant';
import { compiledToSilicaTheme, type SilicaTheme } from './silica-css';
import type { ThemePresetV2 } from './types';

/** The brand identity columns a theme compiles from — the `tenant_brands` row, minus
 *  everything the theme does not read. */
export interface BrandColumns {
  tagline: string | null;
  logoLightMediaId: string | null;
  logoDarkMediaId: string | null;
  faviconMediaId: string | null;
  colorPrimary: string | null;
  colorPrimaryForeground: string | null;
  colorSecondary: string | null;
  colorSecondaryForeground: string | null;
  colorAccent: string | null;
  colorAccentForeground: string | null;
  fontHeading: string | null;
  fontBody: string | null;
  tokens: unknown;
}

/** The scalar (string) brand fields — everything except the opaque `tokens` doc. */
type ScalarBrandField = Exclude<keyof BrandColumns, 'tokens'>;

/** A stored per-site brand override (a partial brand; null/absent = inherit). */
export type BrandOverride = Partial<Record<ScalarBrandField, string | null>> & {
  tokens?: unknown;
};

/** A brand with every field empty — what a tenant that has set nothing compiles from,
 *  and the safe fallback for a failed read. */
export const EMPTY_BRAND: BrandColumns = {
  tagline: null,
  logoLightMediaId: null,
  logoDarkMediaId: null,
  faviconMediaId: null,
  colorPrimary: null,
  colorPrimaryForeground: null,
  colorSecondary: null,
  colorSecondaryForeground: null,
  colorAccent: null,
  colorAccentForeground: null,
  fontHeading: null,
  fontBody: null,
  tokens: null,
};

/**
 * Apply a site's override over the tenant base brand, field-by-field (null/absent =
 * inherit). A falsy override — which is what a primary site has — returns the base
 * unchanged.
 *
 * This is what makes a second site under one tenant look like ITSELF: the primary site
 * edits the tenant base directly, and every other site layers a partial on top.
 */
export function applyBrandOverride(base: BrandColumns, overrideRaw: unknown): BrandColumns {
  if (!overrideRaw || typeof overrideRaw !== 'object' || Array.isArray(overrideRaw)) return base;
  const override = overrideRaw as BrandOverride & { logoMediaId?: string | null };
  const legacyLight = override.logoLightMediaId ?? override.logoMediaId;
  const pick = (k: ScalarBrandField): string | null => override[k] ?? base[k] ?? null;
  return {
    ...base,
    tagline: pick('tagline'),
    logoLightMediaId: legacyLight ?? base.logoLightMediaId ?? null,
    logoDarkMediaId: pick('logoDarkMediaId'),
    faviconMediaId: pick('faviconMediaId'),
    colorPrimary: pick('colorPrimary'),
    colorPrimaryForeground: pick('colorPrimaryForeground'),
    colorSecondary: pick('colorSecondary'),
    colorSecondaryForeground: pick('colorSecondaryForeground'),
    colorAccent: pick('colorAccent'),
    colorAccentForeground: pick('colorAccentForeground'),
    fontHeading: pick('fontHeading'),
    fontBody: pick('fontBody'),
    tokens: override.tokens ?? base.tokens,
  };
}

/** Compile an (already effective) brand into a silica `Theme`. Returns `undefined` on
 *  any failure so the caller falls through to a preset rather than crashing.
 *
 *  `themeKey` NAMES the result — it is what the compiled theme is called — and does
 *  not select anything. The theme itself comes from `preset`, the `.v2` half of the
 *  site's stored `themePreset`; without it the brand compiles over the platform base,
 *  which is right for a site that has picked no theme and wrong for one that has. */
export function tenantTheme(
  brand: BrandColumns,
  config: { themeKey: string; preset?: ThemePresetV2 | null; presentation?: unknown }
): SilicaTheme | undefined {
  try {
    const compiled = compileThemeForTenant({
      preset: config.preset ?? null,
      brand,
      // The v2 surface overlay the theme inspector edits; absent on a fresh config.
      presentation: (config.presentation as never) ?? null,
    });
    return compiledToSilicaTheme(compiled, config.themeKey);
  } catch {
    return undefined;
  }
}
