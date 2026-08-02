// Runtime resolvers (docs/85 §7) — turn a marketplace catalog slug into its
// compiled artifact, read from object storage (NOT a SQL column). Each resolver
// looks up the thin catalog row for the pinned `version`, then reads
// `marketplace/<category>/<slug>/<version>.json`. A row with no artifact (a legacy
// code-resolved item) resolves to null so callers can fall back to the in-code
// registry — the no-deploy data path and the code path coexist during migration.

import { withTenant } from '@sparx/db';
import { readDataThemePreset, type DataThemePreset } from '@sparx/marketplace-schemas';
import { safeParseBlueprint, type Blueprint } from '@sparx/blueprints';

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

/**
 * Resolve a blueprint's full manifest by slug, or null when the tenant can see no
 * such listing (or its artifact is missing/malformed).
 *
 * PUBLISHER-BLIND, WHICH IS THE POINT. It reads the row for its pinned `version`
 * and then the artifact at that version — and that is true whether sparx wrote the
 * object at boot from a bundle in the image or a collaborator uploaded it. Install,
 * update and tenant seeding all come through here, so there is no first-party path
 * to keep working separately from the one an upload will exercise.
 *
 * This is the ONLY resolver. The route and the tenant seeder each carried their own
 * copy, and both also fell back to an in-code `@sparx/blueprints` registry that was
 * deliberately empty — a branch that could only ever return null.
 */
export async function resolveBlueprintManifest(
  tenantId: string,
  key: string
): Promise<Blueprint | null> {
  const row = await withTenant({ tenantId }, (tx) =>
    tx.marketplaceBlueprint.findFirst({ where: { slug: key }, select: { version: true } })
  );
  if (!row) return null;
  const artifact = await readArtifact('blueprints', key, row.version);
  if (artifact == null) return null;
  const parsed = safeParseBlueprint(artifact);
  return parsed.success ? parsed.data : null;
}
