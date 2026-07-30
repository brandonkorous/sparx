// Marketplace THEME purge (docs/85) — the inverse of marketplace:ingest for the
// theme category only. Retires the first-party marketplace THEME catalog: it deletes
// every Sparx-core `marketplace_themes` row AND every theme artifact + card image in
// object storage (ALL versions, not just the current one — artifacts are immutable
// per version, so a per-row delete would orphan older ones).
//
// WHY THIS EXISTS: the old 10 `DataThemePreset` marketplace themes were retired when
// the look system moved to (a) the 20 in-code silica presets in @sparx/silica-catalog
// (the Builder's Themes panel) and (b) the 20 themed `sparx-<name>` BLUEPRINT clones.
// Their repo bundles are gone (marketplace-catalog/themes/), leaving orphaned catalog
// rows this purge clears. Nothing repopulates the marketplace `themes` category today
// — the public market surfaces it as "coming soon", not a live browse.
//
// Run locally against docker Postgres + LocalStorage:
//
//   pnpm --filter @sparx/api-rest marketplace:purge-themes
//
// In prod it runs as a one-off Job with the app env (GCS + Cloud SQL), the same way
// the blueprint purge does — see .github/workflows/marketplace-purge-themes.yml and
// k8s/sparx-prod/marketplace-purge-themes-job.yaml. Gated behind a manual
// workflow_dispatch with a typed confirmation because it is destructive.
//
// Scope + safety (identical posture to the blueprint purge):
//   • Only Sparx-core rows (publisher type=sparx) are removed.
//   • Runs in withSystem (no tenant): the marketplace_visibility RLS policy lets a
//     no-tenant session delete published Sparx-core rows, exactly as ingest upserts.
//   • Other categories (blueprints/components/integrations) are untouched.

import { withSystem } from '@sparx/db';

import { getStorage, marketplaceArtifactPrefix, marketplaceMediaPrefix } from '../lib/storage.js';

// The storage prefixes that hold EVERY theme artifact + card image, across all slugs
// and versions — the object layout's single source of truth is storage.ts, so these
// can't drift from where the ingest writes.
const ARTIFACT_PREFIX = marketplaceArtifactPrefix('themes');
const MEDIA_PREFIX = marketplaceMediaPrefix('themes');

async function purgeRows(): Promise<number> {
  return withSystem(async (tx) => {
    const sparx = await tx.marketplacePublisher.findFirst({
      where: { type: 'sparx' },
      select: { id: true },
    });
    if (!sparx) return 0;
    const { count } = await tx.marketplaceTheme.deleteMany({
      where: { publisherId: sparx.id },
    });
    return count;
  });
}

async function main(): Promise<void> {
  const storage = getStorage();
  console.log(`[purge-themes] storage mode: ${storage.mode}`);

  const rows = await purgeRows();
  console.log(`[purge-themes] deleted ${rows} marketplace_themes row(s).`);

  await storage.deletePrefix(ARTIFACT_PREFIX);
  console.log(`[purge-themes] cleared artifacts under ${ARTIFACT_PREFIX}`);

  await storage.deletePrefix(MEDIA_PREFIX);
  console.log(`[purge-themes] cleared card images under ${MEDIA_PREFIX}`);

  console.log('[purge-themes] done.');
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[purge-themes] failed:', err);
    process.exit(1);
  });
