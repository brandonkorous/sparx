// The PLATFORM data entrypoint — step 2b of the deploy, run as an in-cluster
// Job by deploy-azure.yml immediately after migrations and before the rollout.
//
// This is the production-safe half of seeding. `prisma/seed.ts` is the other
// half and must never run here: it provisions a demo tenant (e2e-staff@sparx.test)
// with an invented parts catalog, orders, bookings and a partner payout. That
// coupling is why NOTHING seeded ever reached production — there was no way to
// ship the platform's own catalog without also shipping a fake business.
//
// Idempotent by construction (see ./platform-seed.ts), so it runs on EVERY
// deploy rather than being a thing someone has to remember. A no-op deploy
// re-upserts a few hundred rows and exits; a deploy that adds a foundation theme
// or a platform component publishes it with no extra step. Failures are FATAL —
// non-zero exit fails the Job, which fails the deploy — because the alternative
// is already documented history: a green pipeline over an empty catalog.
//
// Connects as the OWNER role. platform_components is a global owner-write table
// and several catalog tables are FORCE-RLS with policies that only admit a
// no-tenant write; the app role would be silently filtered rather than rejected.

import { PrismaClient } from '@prisma/client';

import { ownerDatabaseUrl, seedPlatformData } from './platform-seed.js';

const prisma = new PrismaClient({ datasourceUrl: ownerDatabaseUrl() });

async function main(): Promise<void> {
  const started = Date.now();
  console.log('[seed-platform] applying platform data…');
  await seedPlatformData(prisma, { tolerateFailures: false });
  console.log(`[seed-platform] done in ${Math.round((Date.now() - started) / 1000)}s.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err: unknown) => {
    console.error('[seed-platform] FAILED:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
