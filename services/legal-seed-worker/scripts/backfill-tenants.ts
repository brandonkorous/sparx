// One-off backfill (docs/42 §7): seed starter legal pages for tenants that
// existed BEFORE the legal-seed-worker shipped. Rather than duplicate the TS
// template bodies into a SQL migration, this re-publishes `tenant.created` for
// every active tenant — the worker consumes it and seeds idempotently (existing
// pages are skipped), so re-running is safe.
//
// Run AFTER the worker + Terraform (topic + push subscription) are live:
//   GCP_PROJECT_ID=<project> node --import tsx scripts/backfill-tenants.ts
//
// Without GCP_PROJECT_ID the publisher is a logging stub (dry run — prints what
// it WOULD publish), which is handy for a local sanity check.

import { prisma } from '@sparx/db';
import { createPublisher, publishEvent, type PublisherLogger } from '@sparx/events';

const SENTINEL_TENANT = '00000000-0000-0000-0000-000000000000';

const logger: PublisherLogger = {
  info: (obj, msg) => console.log(JSON.stringify({ level: 'info', ...obj, msg })),
  warn: (obj, msg) => console.warn(JSON.stringify({ level: 'warn', ...obj, msg })),
  error: (obj, msg) => console.error(JSON.stringify({ level: 'error', ...obj, msg })),
};

async function main(): Promise<void> {
  const publisher = createPublisher({ logger });
  const tenants = await prisma.tenant.findMany({
    where: { status: 'active', id: { not: SENTINEL_TENANT } },
    select: { id: true, slug: true, name: true },
  });

  logger.info({ count: tenants.length }, 'backfill: publishing tenant.created');
  for (const t of tenants) {
    await publishEvent(
      publisher,
      'tenant.created',
      t.id,
      null,
      { slug: t.slug, name: t.name },
      logger
    );
    logger.info({ tenantId: t.id, slug: t.slug }, 'backfill: published');
  }
  logger.info({ count: tenants.length }, 'backfill: done');
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, 'backfill: failed');
    process.exit(1);
  });
