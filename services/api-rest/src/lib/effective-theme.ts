// The theme a property's site actually renders in — one derivation, two callers.
//
// It lived inside `site-check.ts` while the Check was the only thing that needed to
// know what colours a visitor gets. The legacy-tier retirement needs the SAME answer
// for a different reason: when it re-seeds a site it must hand `starterSite` the theme
// that site already wears, or an operator task would quietly restyle every tenant it
// touched. Two copies of this would drift, and the drift would be invisible — the
// Check grading one palette while the seed writes another.

import type { PropertyContext } from '@sparx/builder';
import type { TxClient } from '@sparx/db';
import {
  applyBrandOverride,
  EMPTY_BRAND,
  storedPresetV2,
  tenantTheme,
  type BrandColumns,
} from '@sparx/site-themes';
import type { Theme } from '@wizeworks/silicaui-html';

/**
 * The theme the site actually renders in.
 *
 * An authored theme wins. Failing that the site renders from the tenant's BRAND,
 * compiled — which is the case for most sites, because the Design inspector is
 * something an author opens on purpose and many never do. `tenantTheme` is the same
 * derivation the builder canvas opens on (it moved into `@sparx/site-themes` so both
 * read one copy), including the per-site brand override that makes a second site under
 * one tenant look like itself.
 *
 * Returns null if every path fails. For the Check that is not a failure — the colour
 * rules simply return nothing and the other twenty-one still run. For a re-seed it is
 * the signal to fall back to a preset rather than write a themeless site.
 */
export async function effectiveTheme(
  tx: TxClient,
  ctx: PropertyContext,
  opts: {
    /** Skip the stored authored theme and compile from brand + preset regardless.
     *  For repairing a stored theme that is itself the thing being corrected — the
     *  authored short-circuit would otherwise just hand back the broken value. */
    ignoreAuthored?: boolean;
  } = {}
): Promise<Theme | null> {
  const [site, brandRow, property, config] = await Promise.all([
    tx.builderSite.findUnique({ where: { propertyId: ctx.propertyId } }),
    tx.tenantBrand.findUnique({ where: { tenantId: ctx.tenantId } }),
    tx.property.findUnique({ where: { id: ctx.propertyId }, select: { brandOverride: true } }),
    tx.siteConfig.findUnique({ where: { propertyId: ctx.propertyId } }),
  ]);

  // The `builder_themes` ROW this site points at wins over the legacy column: a
  // site edited in the per-document editor carries its look as a row, and one
  // edited through the whole-`Site` blob still carries it as a column. A dangling
  // pointer falls through to the column and then to brand-derived, so a deleted
  // look degrades to the tenant's own colours rather than to nothing.
  if (!opts.ignoreAuthored && site?.themeId) {
    const row = await tx.builderTheme.findFirst({
      where: { id: site.themeId, tenantId: ctx.tenantId },
      select: { draftTokens: true },
    });
    if (row?.draftTokens) return row.draftTokens as unknown as Theme;
  }

  const authored = site?.silicaDraftTheme as Theme | null | undefined;
  if (authored && !opts.ignoreAuthored) return authored;

  const base: BrandColumns = brandRow
    ? {
        tagline: brandRow.tagline,
        logoLightMediaId: brandRow.logoLightMediaId,
        logoDarkMediaId: brandRow.logoDarkMediaId,
        faviconMediaId: brandRow.faviconMediaId,
        colorPrimary: brandRow.colorPrimary,
        colorPrimaryForeground: brandRow.colorPrimaryForeground,
        colorSecondary: brandRow.colorSecondary,
        colorSecondaryForeground: brandRow.colorSecondaryForeground,
        colorAccent: brandRow.colorAccent,
        colorAccentForeground: brandRow.colorAccentForeground,
        fontHeading: brandRow.fontHeading,
        fontBody: brandRow.fontBody,
        tokens: brandRow.tokens,
      }
    : EMPTY_BRAND;

  const settings = config?.draftSettings as {
    presentation?: unknown;
    themePreset?: unknown;
  } | null;
  const compiled = tenantTheme(applyBrandOverride(base, property?.brandOverride), {
    themeKey: config?.themeKey ?? 'default',
    // The site's OWN theme, so the caller judges the colours the visitor gets. Without
    // it this compiled the platform base under every site's brand, which reads as
    // "your contrast is fine" about a palette the site does not wear.
    preset: storedPresetV2(settings?.themePreset),
    ...(settings?.presentation === undefined ? {} : { presentation: settings.presentation }),
  });
  return compiled ?? null;
}
