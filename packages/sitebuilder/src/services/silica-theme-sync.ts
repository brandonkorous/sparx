// Write-through from the Site Builder's theme surfaces to the SILICA theme — the
// only theme the storefront renders.
//
// WHY THIS EXISTS. Three surfaces change how a site looks: `select_theme` (pick a
// platform/marketplace preset), `apply_saved_theme` (load one of the tenant's named
// themes), and `update_site_settings` (tweak the presentation overlay). All three
// wrote `site_configs.theme_key` + `draft_settings` and stopped. That is enough for
// the BUILDER, which derives a preview theme from those columns via `tenantTheme` —
// and it is nothing at all to the storefront, which since the `--st-*` retirement
// reads `silicaFrame.theme ?? BASE_SILICA_THEME` (apps/site/app/layout.tsx) and
// derives nothing. So a tenant picked a theme, watched the editor recolour, hit
// publish, and the visitor got sparx Ember. Every surface was reporting success.
//
// The fix is WRITE-side, deliberately. A read-side fallback — "storefront compiles
// the brand columns when no silica theme exists" — would reinstate the second token
// vocabulary that `docs/implementation/st-token-retirement.md` exists to remove: two
// sources for one colour, reconciled by whichever emitter ran last. Compiling ONCE,
// here, keeps `builder_site.silica_draft_theme` the single answer to "what does this
// site look like" for the editor and the visitor alike.
//
// Draft only. Publishing stays a separate deliberate act (publish_site snapshots
// draft → published); a theme change that went straight live would repaint the
// visitor's site the moment someone previewed one.

import type { Prisma, TxClient } from '@sparx/db';
import {
  applyBrandOverride,
  compileThemeForTenant,
  compiledToSilicaTheme,
  type BrandColumns,
  type PresentationOverlayV2,
  type ThemePresetV2,
} from '@sparx/site-themes';

export interface SilicaThemeSyncArgs {
  /** The preset key the site now wears — `site_configs.theme_key`. */
  themeKey: string;
  /** The v2 presentation overlay from `draft_settings.presentation`, if any. */
  presentation: unknown;
  /** A marketplace DATA theme's inline preset from `draft_settings.themePreset`.
   *  Passed through so a data theme compiles from the artifact it actually carries;
   *  without it `themeKey` would be looked up in the code registry, miss, and the
   *  whole compile would fail — silently leaving a marketplace theme unrendered. */
  themePreset?: unknown;
  /** A brand override the CALLER just computed, so it doesn't have to be re-read
   *  (and can't drift from what was written). Null → read the stored one. */
  brandOverride?: Record<string, unknown> | null;
}

/** The stored `draft_settings` slices this module reads, named once. */
export function readDraftThemeSlices(draftSettings: unknown): {
  presentation: unknown;
  themePreset: unknown;
} {
  const d =
    draftSettings && typeof draftSettings === 'object' && !Array.isArray(draftSettings)
      ? (draftSettings as Record<string, unknown>)
      : {};
  return { presentation: d.presentation, themePreset: d.themePreset };
}

/**
 * Compile the site's effective look and store it as the site's DRAFT silica theme.
 *
 * Returns whether a theme was written. Best-effort by design: a preset that won't
 * compile must not fail the operation that triggered it — the theme_key and settings
 * still land, and the site keeps the theme it already had rather than the caller's
 * whole transaction rolling back over a palette. The boolean is returned rather than
 * swallowed so a headless caller can tell "applied" from "applied everywhere".
 */
export async function syncSilicaDraftTheme(
  tx: TxClient,
  tenantId: string,
  propertyId: string,
  args: SilicaThemeSyncArgs
): Promise<boolean> {
  const [brandRow, property] = await Promise.all([
    tx.tenantBrand.findUnique({ where: { tenantId } }),
    // Only read the stored override when the caller didn't supply one. A legacy saved
    // theme carries no brand snapshot, and its presentation still has to compile
    // against whatever this site already wears — not the bare tenant base.
    args.brandOverride
      ? null
      : tx.property.findUnique({ where: { id: propertyId }, select: { brandOverride: true } }),
  ]);

  const base: BrandColumns = {
    tagline: brandRow?.tagline ?? null,
    logoLightMediaId: brandRow?.logoLightMediaId ?? null,
    logoDarkMediaId: brandRow?.logoDarkMediaId ?? null,
    faviconMediaId: brandRow?.faviconMediaId ?? null,
    colorPrimary: brandRow?.colorPrimary ?? null,
    colorPrimaryForeground: brandRow?.colorPrimaryForeground ?? null,
    colorSecondary: brandRow?.colorSecondary ?? null,
    colorSecondaryForeground: brandRow?.colorSecondaryForeground ?? null,
    colorAccent: brandRow?.colorAccent ?? null,
    colorAccentForeground: brandRow?.colorAccentForeground ?? null,
    fontHeading: brandRow?.fontHeading ?? null,
    fontBody: brandRow?.fontBody ?? null,
    tokens: brandRow?.tokens ?? null,
  };
  const effective = applyBrandOverride(base, args.brandOverride ?? property?.brandOverride ?? null);

  let theme;
  try {
    const compiled = compileThemeForTenant({
      themeKey: args.themeKey,
      preset: (args.themePreset as ThemePresetV2 | undefined) ?? null,
      brand: effective,
      presentation: (args.presentation as PresentationOverlayV2 | undefined) ?? null,
    });
    theme = compiledToSilicaTheme(compiled, args.themeKey);
  } catch {
    return false;
  }

  await tx.builderSite.upsert({
    where: { propertyId },
    create: { tenantId, propertyId, silicaDraftTheme: theme as unknown as Prisma.InputJsonValue },
    update: { silicaDraftTheme: theme as unknown as Prisma.InputJsonValue },
  });
  return true;
}
