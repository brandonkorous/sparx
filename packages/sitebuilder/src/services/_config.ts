// Shared helper — lazily materialize the per-(tenant, PROPERTY) SiteConfig row.
//
// A site gets a SiteConfig the first time it is touched in the Site Builder
// (select a theme, add a section, open the customizer). Defaulting lazily keeps
// sites that never use the module out of the table. Per-property (docs/49
// Phase 6): each of a tenant's sites keeps its own draft config.

import type { Prisma, SiteConfig, TxClient } from '@sparx/db';
import { SPARX_THEMES, resolveSparxTheme } from '@sparx/silica-catalog';

// The look a site gets when it is created WITHOUT a blueprint — someone opens
// the builder on a bare site and starts editing.
//
// This used to be DEFAULT_THEME_KEY from @sparx/site-themes ('apex'), one of six
// legacy presets that predate the silica catalog. Every existing site is still on
// one of them (apex ×4, drift ×2, market ×1) because this constant is where they
// came from, and none of the twenty real themes was reachable from here at all.
//
// `studio` is the achromatic one: chroma zero on every surface with a single hot
// magenta reserved for interaction — the highest-chroma accent in the library
// against pure white. It reads as a deliberate design choice rather than an
// un-themed default, which is exactly what a starting point should do.
//
// Resolved from CODE, not from the marketplace artifact. The catalog row and its
// stored artifact are how a *creator's* theme reaches a site, and they require the
// ingest to have run; a platform default must not. `resolveSparxTheme` expands the
// authored theme into the same flat token bag `selectTheme` stores, so a bare new
// site and one where the operator picked "studio" in the picker are byte-identical.
const DEFAULT_THEME_SLUG = 'studio';

function defaultThemePreset(): Prisma.InputJsonValue | undefined {
  const theme = SPARX_THEMES.find((t) => t.name === DEFAULT_THEME_SLUG);
  // Never throw over a cosmetic default: a renamed theme should leave the site
  // on the compile engine's own fallback, not fail to create a config at all.
  return theme ? (resolveSparxTheme(theme) as unknown as Prisma.InputJsonValue) : undefined;
}

export async function getOrCreateConfig(
  tx: TxClient,
  tenantId: string,
  propertyId: string
): Promise<SiteConfig> {
  const existing = await tx.siteConfig.findUnique({
    where: { tenantId_propertyId: { tenantId, propertyId } },
  });
  if (existing) return existing;
  const themePreset = defaultThemePreset();
  return tx.siteConfig.create({
    data: {
      tenantId,
      propertyId,
      themeKey: DEFAULT_THEME_SLUG,
      appearancePolicy: 'light-only',
      // themePreset carries the resolved tokens, exactly as selectTheme writes
      // them. themeKey alone would not be enough: it is not one of the six code
      // presets, so the compile engine would find nothing and fall back.
      draftSettings: {
        tokens: { light: {}, dark: {} },
        customCss: '',
        ...(themePreset ? { themePreset } : {}),
      },
    },
  });
}

/**
 * Ensure the config for the tenant's PRIMARY property. Used by the LEGACY section
 * tier (page layouts / sections / layout blocks) which stays tenant-wide
 * (docs/49 Phase 6) and conceptually belongs to the primary site — it just needs
 * *a* config row to exist. Resolves the primary within the tx (RLS-scoped). Every
 * tenant has exactly one primary (migration 20260626000000_properties).
 */
export async function getOrCreatePrimaryConfig(
  tx: TxClient,
  tenantId: string
): Promise<SiteConfig> {
  const primary = await tx.property.findFirst({
    where: { isPrimary: true },
    select: { id: true },
  });
  if (!primary) throw new Error(`No primary property for tenant ${tenantId}`);
  return getOrCreateConfig(tx, tenantId, primary.id);
}
