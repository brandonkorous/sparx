// One-off backfill (docs/140 §7): put every tenant that existed BEFORE this
// worker shipped onto the platform signup board, so the board is a complete
// picture of the customer base rather than "everyone since Tuesday".
//
// This calls the mirror DIRECTLY rather than re-publishing tenant.created — the
// mirror reads each tenant's current row (name, trial end, modules, subscription
// status), so a backfilled tenant lands in the stage it actually belongs in
// instead of replaying a signup that happened months ago. Idempotent: re-running
// updates the same contact + deal.
//
// Cloud SQL is private-IP, so this runs as a Cloud Run JOB on the worker's own
// image (terraform/envs/prod/serverless.tf) — same VPC connector, same DB
// secret, same service account. That matters: the mirror writes THROUGH the CRM
// service layer under RLS, so it must run as the same role the worker does, not
// as the migration owner.
//
//   gcloud run jobs execute platform-crm-backfill --region us-central1 --wait
//   gcloud run jobs execute platform-crm-backfill --region us-central1 --wait \
//     --args=--import,tsx,scripts/backfill-tenants.ts,--apply
//
// DRY-RUN BY DEFAULT (matching wizeworks/packages/db/scripts/backfill-*.ts): it lists what
// it would touch and writes nothing until `--apply` is passed.

import { prisma } from '@wizeworks/db';
import { mirrorTenant, recordSubscriptionChange, type MirrorLogger } from '@wizeworks/platform-crm';

const SENTINEL_TENANT = '00000000-0000-0000-0000-000000000000';

const logger: MirrorLogger = {
  info: (obj, msg) => console.log(JSON.stringify({ level: 'info', ...obj, msg })),
  warn: (obj, msg) => console.warn(JSON.stringify({ level: 'warn', ...obj, msg })),
  error: (obj, msg) => console.error(JSON.stringify({ level: 'error', ...obj, msg })),
};

async function main(): Promise<void> {
  // Same flag convention as the wizeworks/packages/db backfills: no `--apply`, no writes.
  const dryRun = !process.argv.includes('--apply');
  const tenants = await prisma.tenant.findMany({
    where: { status: 'active', id: { not: SENTINEL_TENANT } },
    select: { id: true, slug: true, subscriptionStatus: true },
    orderBy: { createdAt: 'asc' },
  });

  logger.info({ count: tenants.length, dryRun }, 'backfill: mirroring tenants');
  let mirrored = 0;
  let skipped = 0;

  for (const t of tenants) {
    if (dryRun) {
      logger.info({ tenantId: t.id, slug: t.slug }, 'backfill: would mirror');
      continue;
    }
    const outcome = await mirrorTenant(t.id, logger);
    if (outcome.status === 'skipped') {
      skipped++;
      logger.warn({ tenantId: t.id, slug: t.slug, reason: outcome.reason }, 'backfill: skipped');
      continue;
    }
    mirrored++;

    // A backfilled tenant that already pays (or already churned) must not sit in
    // Trial — replay its CURRENT status through the same lifecycle rules the
    // webhook uses, so the board reflects reality on the first run.
    if (t.subscriptionStatus && t.subscriptionStatus !== 'trialing') {
      await recordSubscriptionChange(t.id, { status: t.subscriptionStatus }, logger);
    }
  }

  logger.info({ count: tenants.length, mirrored, skipped, dryRun }, 'backfill: done');
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, 'backfill: failed');
    process.exit(1);
  });
