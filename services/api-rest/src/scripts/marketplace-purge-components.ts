// Marketplace COMPONENT purge (docs/85) — the inverse of marketplace:ingest for the
// component category only. Clears every Sparx-core `marketplace_components` row AND
// every component artifact + card image in object storage (ALL versions, not just the
// current one — artifacts are immutable per version, so a per-row delete would orphan
// older ones).
//
// WHY THIS EXISTS: the 10 legacy `BuilderNode` marketplace components were retired when
// the component system moved to the silica catalog sections in @sparx/silica-catalog
// (the Builder's Insert palette). The new shelf is 71 silica-native `component` bundles
// (marketplace-catalog/components/) rendered as LIVE previews (docs/118). Because ingest
// is upsert-only (it never prunes), the retired slugs (hero-split, cta-banner, …) would
// linger — this purge removes them.
//
// ORDER MATTERS: unlike the theme purge (nothing repopulates that category), the
// component shelf IS repopulated. Run this FIRST, then ingest:
//
//   pnpm --filter @sparx/api-rest marketplace:purge-components
//   pnpm --filter @sparx/api-rest marketplace:ingest
//
// The purge clears ALL Sparx-core component rows; ingest then re-creates the 71 current
// ones. Running it AFTER ingest would wipe the fresh rows too — it is destructive, which
// is why prod gates it behind a typed workflow_dispatch (see
// .github/workflows/marketplace-purge-components.yml + k8s/sparx-prod/
// marketplace-purge-components-job.yaml).
//
// Scope + safety (identical posture to the theme/blueprint purge):
//   • Only Sparx-core rows (publisher type=sparx) are removed.
//   • Runs in withSystem (no tenant): the marketplace_visibility RLS policy lets a
//     no-tenant session delete published Sparx-core rows, exactly as ingest upserts.
//   • Other categories (blueprints/themes/integrations) are untouched.

import { withSystem } from '@sparx/db';

import { getStorage, marketplaceArtifactPrefix, marketplaceMediaPrefix } from '../lib/storage.js';

// The storage prefixes that hold EVERY component artifact + card image, across all
// slugs and versions — the object layout's single source of truth is storage.ts, so
// these can't drift from where the ingest writes.
const ARTIFACT_PREFIX = marketplaceArtifactPrefix('components');
const MEDIA_PREFIX = marketplaceMediaPrefix('components');

async function purgeRows(): Promise<number> {
  return withSystem(async (tx) => {
    const sparx = await tx.marketplacePublisher.findFirst({
      where: { type: 'sparx' },
      select: { id: true },
    });
    if (!sparx) return 0;
    const { count } = await tx.marketplaceComponent.deleteMany({
      where: { publisherId: sparx.id },
    });
    return count;
  });
}

async function main(): Promise<void> {
  const storage = getStorage();
  console.log(`[purge-components] storage mode: ${storage.mode}`);

  const rows = await purgeRows();
  console.log(`[purge-components] deleted ${rows} marketplace_components row(s).`);

  await storage.deletePrefix(ARTIFACT_PREFIX);
  console.log(`[purge-components] cleared artifacts under ${ARTIFACT_PREFIX}`);

  await storage.deletePrefix(MEDIA_PREFIX);
  console.log(`[purge-components] cleared card images under ${MEDIA_PREFIX}`);

  console.log('[purge-components] done.');
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[purge-components] failed:', err);
    process.exit(1);
  });
