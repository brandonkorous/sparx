// Marketplace BLUEPRINT purge (docs/85) — the inverse of marketplace:ingest for
// the blueprint category only. Tears down the first-party blueprint catalog so a
// fresh set can be authored + ingested: it deletes every Sparx-core
// `marketplace_blueprints` row AND every blueprint artifact + card image in object
// storage (ALL versions, not just the current one — artifacts are immutable per
// version, so a per-row delete would orphan older ones).
//
// Run locally against docker Postgres + LocalStorage:
//
//   pnpm --filter @sparx/api-rest marketplace:purge-blueprints
//
// In prod it runs as a one-off Job with the app env (GCS + Cloud SQL), the same way
// the ingest does — see .github/workflows/marketplace-purge-blueprints.yml and
// k8s/sparx-prod/marketplace-purge-blueprints-job.yaml. It is gated behind a manual
// workflow_dispatch with a typed confirmation because it is destructive.
//
// Scope + safety:
//   • Only Sparx-core rows (publisher type=sparx) are removed — a tenant/partner
//     published blueprint (Phase 5+) is left untouched.
//   • Runs in withSystem (no tenant): the marketplace_visibility RLS policy lets a
//     no-tenant session delete published Sparx-core rows (status='published'),
//     exactly as the ingest upserts them.
//   • It does NOT touch tenant_blueprint_installs — an installed site is the
//     tenant's, torn down via the per-install Reset, not a catalog purge.
//   • Other categories (themes/components/integrations) are untouched.

import { withSystem } from '@sparx/db';

import { getStorage, marketplaceArtifactPrefix, marketplaceMediaPrefix } from '../lib/storage.js';

// The storage prefixes that hold EVERY blueprint artifact + card image, across all
// slugs and versions — the single source of truth for the object layout lives in
// storage.ts, so these can't drift from where the ingest writes.
const ARTIFACT_PREFIX = marketplaceArtifactPrefix('blueprints');
const MEDIA_PREFIX = marketplaceMediaPrefix('blueprints');

async function purgeRows(): Promise<number> {
  return withSystem(async (tx) => {
    const sparx = await tx.marketplacePublisher.findFirst({
      where: { type: 'sparx' },
      select: { id: true },
    });
    if (!sparx) return 0;
    const { count } = await tx.marketplaceBlueprint.deleteMany({
      where: { publisherId: sparx.id },
    });
    return count;
  });
}

async function main(): Promise<void> {
  const storage = getStorage();
  console.log(`[purge-blueprints] storage mode: ${storage.mode}`);

  const rows = await purgeRows();
  console.log(`[purge-blueprints] deleted ${rows} marketplace_blueprints row(s).`);

  await storage.deletePrefix(ARTIFACT_PREFIX);
  console.log(`[purge-blueprints] cleared artifacts under ${ARTIFACT_PREFIX}`);

  await storage.deletePrefix(MEDIA_PREFIX);
  console.log(`[purge-blueprints] cleared card images under ${MEDIA_PREFIX}`);

  console.log('[purge-blueprints] done.');
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[purge-blueprints] failed:', err);
    process.exit(1);
  });
