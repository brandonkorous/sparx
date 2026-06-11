// Runtime resolvers (docs/85 §7) — turn a marketplace catalog slug into its
// compiled artifact, read from object storage (NOT a SQL column). Each resolver
// looks up the thin catalog row for the pinned `version`, then reads
// `marketplace/<category>/<slug>/<version>.json`. A row with no artifact (a legacy
// code-resolved item) resolves to null so callers can fall back to the in-code
// registry — the no-deploy data path and the code path coexist during migration.

import { withTenant } from '@sparx/db';
import { readDataThemePreset, type DataThemePreset } from '@sparx/marketplace-schemas';

import { readArtifact } from './artifacts.js';

/**
 * Resolve a marketplace DATA theme's full `DataThemePreset` by slug, or null when
 * the slug is not a marketplace data theme (no catalog row, or a row whose payload
 * was never ingested — e.g. a code foundation). The theme route injects this into
 * `themeService.selectTheme` (the @sparx/sitebuilder package can't reach storage).
 */
export async function resolveThemePreset(
  tenantId: string,
  slug: string
): Promise<DataThemePreset | null> {
  const row = await withTenant({ tenantId }, (tx) =>
    tx.marketplaceTheme.findFirst({ where: { slug }, select: { version: true } })
  );
  if (!row) return null;
  const artifact = await readArtifact('themes', slug, row.version);
  if (artifact == null) return null;
  // Validate the stored artifact at the boundary — a malformed object resolves to
  // null (falls back to code) rather than corrupting the tenant's draft settings.
  return readDataThemePreset(artifact);
}
