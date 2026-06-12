// Shared helper — lazily materialize the per-(tenant, PROPERTY) SiteConfig row.
//
// A site gets a SiteConfig the first time it is touched in the Site Builder
// (select a theme, add a section, open the customizer). Defaulting lazily keeps
// sites that never use the module out of the table. Per-property (docs/49
// Phase 6): each of a tenant's sites keeps its own draft config.

import type { SiteConfig, TxClient } from '@sparx/db';
import { DEFAULT_THEME_KEY } from '@sparx/site-themes';

export async function getOrCreateConfig(
  tx: TxClient,
  tenantId: string,
  propertyId: string
): Promise<SiteConfig> {
  const existing = await tx.siteConfig.findUnique({
    where: { tenantId_propertyId: { tenantId, propertyId } },
  });
  if (existing) return existing;
  return tx.siteConfig.create({
    data: {
      tenantId,
      propertyId,
      themeKey: DEFAULT_THEME_KEY,
      appearancePolicy: 'light-only',
      draftSettings: { tokens: { light: {}, dark: {} }, customCss: '' },
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
