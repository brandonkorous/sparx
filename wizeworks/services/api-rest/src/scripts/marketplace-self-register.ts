// Publish sparx's own catalog into the marketplace rows — the CLI face of
// `selfRegisterFirstPartyCatalog`.
//
// The REAL trigger is service boot (see lib/marketplace/self-register.ts): a
// platform that ships its own catalog should not need anyone to run anything. This
// script exists for the two cases where a human wants the same thing on demand —
// working locally against docker Postgres, and re-asserting the shelf from an ops
// task without waiting for a restart.
//
//   pnpm --filter @wizeworks/api-rest marketplace:self-register
//
// Idempotent: upsert by slug, retract by absence. Running it twice changes nothing
// the second time.

import {
  selfRegisterFirstPartyCatalog,
  type SelfRegisterReport,
} from '../lib/marketplace/self-register.js';

async function main(): Promise<void> {
  const report = await selfRegisterFirstPartyCatalog();
  const categories: (keyof SelfRegisterReport)[] = [
    'themes',
    'components',
    'blueprints',
    'integrations',
  ];
  for (const category of categories) {
    const r = report[category];
    console.log(`  ${category.padEnd(11)} published ${r.published}`);
    if (r.pruned.length) {
      console.log(`  ${''.padEnd(11)} retracted ${r.pruned.length}: ${r.pruned.join(', ')}`);
    }
  }
  // Blueprints are the only category with bytes in object storage (manifest +
  // card imagery). Zero here on a re-run is the expected steady state, and the
  // number worth seeing when a bundle has just changed.
  console.log(`  ${''.padEnd(11)} storage objects written ${report.blueprints.objectsWritten}`);
  console.log('[marketplace-self-register] done.');
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[marketplace-self-register] failed:', err);
    process.exit(1);
  });
