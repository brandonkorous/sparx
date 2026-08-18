// One-off verification for the retract-by-absence half of self-registration.
//
// It is a DELETE path scoped by publisher, so the two things worth proving are that
// it removes a stale sparx row and that it leaves a collaborator's listing alone —
// the second is what makes it safe to run on every boot of a marketplace that will
// carry other people's work. Run against docker Postgres:
//
//   pnpm --filter @wizeworks/api-rest exec tsx src/scripts/verify-self-register-prune.ts

import { withSystem } from '@wizeworks/db';
import { selfRegisterFirstPartyCatalog } from '../lib/marketplace/self-register.js';

const STALE = 'zz-stale-sparx-theme';
const PARTNER = 'zz-partner-theme';

async function main(): Promise<void> {
  const { sparxId, partnerId } = await withSystem(async (tx) => {
    const sparx = await tx.marketplacePublisher.findFirstOrThrow({ where: { type: 'sparx' } });
    const partner = await tx.marketplacePublisher.upsert({
      where: { slug: 'zz-test-partner' },
      update: {},
      create: {
        slug: 'zz-test-partner',
        type: 'partner',
        displayName: 'Test Partner',
        verified: true,
      },
    });
    const row = {
      name: 'ZZ',
      tagline: 'test',
      description: '',
      version: '1.0.0',
      status: 'published',
      visibility: 'public',
      priceCents: 0,
      pricingModel: 'free',
    };
    // A sparx row with no source in code — exactly the orphan shape production carried.
    await tx.marketplaceTheme.upsert({
      where: { slug: STALE },
      update: { publisherId: sparx.id },
      create: { slug: STALE, publisherId: sparx.id, publishedAt: new Date(), ...row },
    });
    // A collaborator's listing, which must survive untouched.
    await tx.marketplaceTheme.upsert({
      where: { slug: PARTNER },
      update: { publisherId: partner.id },
      create: { slug: PARTNER, publisherId: partner.id, publishedAt: new Date(), ...row },
    });
    return { sparxId: sparx.id, partnerId: partner.id };
  });
  console.log(`seeded stale sparx row + partner row (sparx=${sparxId} partner=${partnerId})`);

  const report = await selfRegisterFirstPartyCatalog();
  console.log('pruned themes:', report.themes.pruned.join(', ') || '(none)');

  const [stale, partner] = await withSystem(async (tx) => [
    await tx.marketplaceTheme.findUnique({ where: { slug: STALE } }),
    await tx.marketplaceTheme.findUnique({ where: { slug: PARTNER } }),
  ]);

  const ok = stale === null && partner !== null;
  console.log(`stale sparx row removed : ${stale === null ? 'YES' : 'NO  <-- FAIL'}`);
  console.log(`partner row survived    : ${partner !== null ? 'YES' : 'NO  <-- FAIL'}`);

  // Leave nothing behind.
  await withSystem(async (tx) => {
    await tx.marketplaceTheme.deleteMany({ where: { slug: { in: [STALE, PARTNER] } } });
    await tx.marketplacePublisher.deleteMany({ where: { slug: 'zz-test-partner' } });
  });
  console.log(ok ? 'PASS' : 'FAIL');
  process.exit(ok ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
