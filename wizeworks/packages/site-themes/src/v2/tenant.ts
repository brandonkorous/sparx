// Token Model v2 — tenant-facing compile entry (docs/33-token-model-v2.md §5).
//
// The ONE function the live read paths call: given the site's theme preset, the
// tenant's brand columns, and the Site Builder presentation overlay, produce a
// complete CompiledThemeV2. Both the published-snapshot read (publish-service) and
// the builder's live preview go through here, so the storefront SSR and the editor
// preview can never drift.
//
// Brand identity (primary/accent/type) is read from the existing TenantBrand
// columns; shape/rhythm/effect arrive with the §2.4 `TenantBrand.tokens` JSONB
// column, at which point `brandColsToTokenDoc` widens to merge that doc in.

import { compileTokensV2 } from './compile';
import { PLATFORM_PRESET_V2 } from '../presets/v2';
import type { BrandTokenDoc, CompiledThemeV2, PresentationOverlayV2, ThemePresetV2 } from './types';

/** Tenant brand as stored in the TenantBrand columns + the `tokens` JSONB (the
 *  subset the v2 engine consumes; selected by publish-service and returned by
 *  /v1/brand). Color/type are dedicated columns; shape/rhythm/effect live in
 *  the `tokens` doc — one source of truth per axis. */
export interface TenantBrandColumns {
  colorPrimary?: string | null;
  colorPrimaryForeground?: string | null;
  colorAccent?: string | null;
  colorAccentForeground?: string | null;
  colorSecondary?: string | null;
  colorSecondaryForeground?: string | null;
  fontHeading?: string | null;
  fontBody?: string | null;
  // Partial BrandTokenDoc (shape/rhythm/effect branches). `unknown` because it
  // arrives untyped from Prisma JSONB / the brand API; read defensively below.
  tokens?: unknown;
}

/** Project the TenantBrand columns + `tokens` doc onto a v2 brand token doc.
 *  Color/type come from the columns (they win); shape/rhythm/effect from the
 *  `tokens` JSONB. Empty/absent values stay null/undefined so the compiler falls
 *  through to the preset default (resolveShared/resolveColors read defensively). */
export function brandColsToTokenDoc(cols: TenantBrandColumns | null | undefined): BrandTokenDoc {
  const tokens = (cols?.tokens ?? undefined) as BrandTokenDoc | undefined;
  return {
    v: 2,
    color: {
      primary: cols?.colorPrimary ?? null,
      primaryContent: cols?.colorPrimaryForeground ?? null,
      accent: cols?.colorAccent ?? null,
      accentContent: cols?.colorAccentForeground ?? null,
      secondary: cols?.colorSecondary ?? null,
      secondaryContent: cols?.colorSecondaryForeground ?? null,
    },
    type: {
      heading: cols?.fontHeading ?? null,
      body: cols?.fontBody ?? null,
    },
    shape: tokens?.shape,
    rhythm: tokens?.rhythm,
    effect: tokens?.effect,
  };
}

export interface CompileForTenantArgs {
  /** The site's own v2 preset — carried per-site in `SiteConfig.draftSettings.
   *  themePreset` (written on apply by every theme surface). Absent/null → the
   *  platform base.
   *
   *  This used to be optional in a different sense: the compile took a `themeKey`
   *  and, with no preset, resolved one of six code presets by name. The six are
   *  retired, so a key resolved nothing while still looking authoritative — a site
   *  on `clinic` compiled the default and reported success. The key is gone; a
   *  theme is passed, not named. */
  preset?: ThemePresetV2 | null;
  /** TenantBrand identity columns (brand-owned slots win). */
  brand?: TenantBrandColumns | null;
  /** The Site Builder presentation overlay (surfaces/neutral/status/border). */
  presentation?: PresentationOverlayV2 | null;
}

/**
 * Compile a site's storefront theme: its v2 preset (or the platform base), with
 * brand identity layered on top and the tenant's presentation overlay over that.
 * Always complete (the preset supplies every slot) even with no brand/overlay.
 */
export function compileThemeForTenant(args: CompileForTenantArgs): CompiledThemeV2 {
  return compileTokensV2(args.preset ?? PLATFORM_PRESET_V2, {
    brand: brandColsToTokenDoc(args.brand),
    presentation: args.presentation ?? null,
  });
}

/**
 * The v2 preset out of a site's stored `themePreset` blob (`{ v, v1, v2 }`, written
 * by every theme surface). Null when the site carries none, or when the blob is not
 * the shape it claims — either way the caller compiles the platform base.
 *
 * Lives here, once, because three callers need it (the draft write-through, the
 * pre-publish check, the builder canvas) and a cast is how it went wrong before:
 * the WRAPPER was passed where the preset belonged, so `.shared` came back undefined
 * and the compile threw into a caller's `catch` that reported success.
 */
export function storedPresetV2(themePreset: unknown): ThemePresetV2 | null {
  if (!themePreset || typeof themePreset !== 'object') return null;
  const v2 = (themePreset as { v2?: unknown }).v2;
  return v2 && typeof v2 === 'object' && 'shared' in v2 ? (v2 as ThemePresetV2) : null;
}
