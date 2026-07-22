// The tenant's brand → the silica `Theme` the canvas opens on, and the per-site
// override that decides WHICH brand a non-primary site previews.
//
// Mirrors the dashboard studio's `tenantTheme` + `applyBrandOverride` (docs/49):
// the primary site edits the tenant base brand directly; a non-primary site layers
// a partial override on top (null fields inherit). Compiling from the EFFECTIVE
// brand is what makes a second site open on ITS look, not the tenant default.
//
// Every step degrades gracefully — a failed compile falls through to the caller's
// preset — because a brand hiccup must never take the whole editor down.

import { compileThemeForTenant, compiledToSilicaTheme } from '@sparx/site-themes';
import type { Theme } from '@wizeworks/silicaui-html';

/** The brand identity columns the theme compiles from (a subset of `/v1/brand`). */
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

/** Apply a site's override over the tenant base brand, field-by-field (null/absent
 *  = inherit). Pass a falsy override (a primary site) → the base unchanged. */
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

/** Compile the tenant's (effective) brand into a silica `Theme`, so the canvas
 *  previews the real brand — colours, type, rounding. Returns `undefined` on any
 *  failure so the caller falls through to a preset rather than crashing. */
export function tenantTheme(
  brand: BrandColumns,
  config: { themeKey: string; presentation?: unknown }
): Theme | undefined {
  try {
    const compiled = compileThemeForTenant({
      themeKey: config.themeKey,
      brand,
      // The v2 surface overlay the theme inspector edits; absent on a fresh config.
      presentation: (config.presentation as never) ?? null,
    });
    return compiledToSilicaTheme(compiled, config.themeKey);
  } catch {
    return undefined;
  }
}
