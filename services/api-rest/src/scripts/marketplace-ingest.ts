// First-party marketplace ingest (docs/85 §5/§14). Reads every bundle under the
// `marketplace-catalog/<category>/<slug>/` tree, compiles + validates each, and
// writes its artifact to object storage + a thin catalog row — the no-deploy data
// path. Run locally against docker Postgres + LocalStorage:
//
//   pnpm --filter @sparx/api-rest marketplace:ingest
//
// In prod this runs as a one-off Job with the app env (GCS + Cloud SQL), the same
// way the DB seed does — see packages/db/CLAUDE.md.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ingestCatalog, IngestError } from '../lib/marketplace/ingest.js';

const here = dirname(fileURLToPath(import.meta.url));
// services/api-rest/src/scripts → repo root is four levels up.
const repoRoot = resolve(here, '../../../..');
const root = process.env.MARKETPLACE_CATALOG_DIR ?? resolve(repoRoot, 'marketplace-catalog');

async function main(): Promise<void> {
  console.log(`[marketplace-ingest] reading bundles from ${root}`);
  const results = await ingestCatalog(root);
  if (results.length === 0) {
    console.log('[marketplace-ingest] no bundles found — nothing to ingest.');
    return;
  }
  for (const r of results) {
    console.log(`  ${r.written ? 'wrote ' : 'skip  '} ${r.category}/${r.slug}@${r.version}`);
  }
  const written = results.filter((r) => r.written).length;
  console.log(`[marketplace-ingest] done: ${written} written, ${results.length} total.`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    if (err instanceof IngestError) {
      console.error(`[marketplace-ingest] DENIED (${err.dir}): ${err.message}`);
    } else {
      console.error('[marketplace-ingest] failed:', err);
    }
    process.exit(1);
  });
