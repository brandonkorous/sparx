// Import-worker message handler.
//
// Flow:
//   1. Parse the `import.job.created` payload.
//   2. Load the ImportJob (including rawRows) from the DB.
//   3. Look the entity's processor up in the registry.
//   4. Run it (or preview it, for a dry run) and write per-row results.
//   5. Mark the job completed, or failed if the run itself threw.
//
// Failure model:
//   - Per-row validation/service errors: the row is written with status='error', the
//     job continues, and `error_count` increments. No nack — one bad row in a 9,000
//     row file must not cost the other 8,999.
//   - Job not found / DB unavailable: throw, so the caller nacks and it is redelivered.
//   - Unknown entity type: ack with the job marked failed. A nack would redeliver
//     forever, because the next attempt cannot know an entity the code does not have.
//
// This used to carry a four-arm if/else, each arm holding an identical copy of the
// result-writing loop below. Every new entity meant a fifth copy, which is a large
// part of why there was never a fifth entity. The registry in ./processors replaced it.

import type { Logger } from 'pino';
import { z } from 'zod';
import { prisma, withTenant } from '@sparx/db';

import { getProcessor } from './processors';
import type { ImportRow, ProcessorContext } from './processors';

const ImportJobCreatedPayload = z.object({
  jobId: z.string().uuid(),
  /** Free-form so a new processor needs no change here; the registry is the gate. */
  entityType: z.string().min(1).max(50),
});

export interface HandleOutcome {
  jobId: string;
  status: 'completed' | 'failed' | 'unknown_job';
  imported: number;
  updated: number;
  errors: number;
  skipped?: number;
}

/** Options carried on the job. `migrationRunId` groups the jobs of one migration —
 *  a run is a set of jobs sharing it, which is what lets a whole migration be
 *  reported on without a table of its own. */
const JobOptions = z
  .object({
    upsert: z.boolean().optional(),
    dryRun: z.boolean().optional(),
    vendor: z.string().max(64).optional(),
    migrationRunId: z.string().max(64).optional(),
    propertyId: z.string().uuid().nullable().optional(),
  })
  .passthrough();

export function parseEvent(raw: unknown): z.infer<typeof ImportJobCreatedPayload> | null {
  const result = ImportJobCreatedPayload.safeParse(raw);
  return result.success ? result.data : null;
}

export async function handle(
  payload: z.infer<typeof ImportJobCreatedPayload>,
  logger: Logger
): Promise<HandleOutcome> {
  const { jobId, entityType } = payload;
  const log = logger.child({ jobId, entityType });

  const job = await prisma.importJob.findFirst({ where: { id: jobId } });
  if (!job) {
    log.warn('job not found — may have been deleted; acking');
    return { jobId, status: 'unknown_job', imported: 0, updated: 0, errors: 0 };
  }

  const rawRows = job.rawRows as ImportRow[];
  const parsedOptions = JobOptions.safeParse(job.options ?? {});
  const options = parsedOptions.success ? parsedOptions.data : {};

  const processor = getProcessor(entityType);
  if (processor === undefined) {
    log.warn({ entityType }, 'no processor for this entity — marking job failed');
    await withTenant({ tenantId: job.tenantId }, (tx) =>
      tx.importJob.update({
        where: { id: jobId },
        data: { status: 'failed', errorCount: rawRows.length, completedAt: new Date() },
      })
    );
    return { jobId, status: 'failed', imported: 0, updated: 0, errors: rawRows.length };
  }

  // The tenant's slug is needed by the media path to build public URLs, and the
  // property scopes content, redirects and orders to the site being migrated.
  const tenant = await prisma.tenant.findFirst({
    where: { id: job.tenantId },
    select: { slug: true },
  });

  const ctx: ProcessorContext = {
    tenantId: job.tenantId,
    ...(job.actorId === null ? {} : { userId: job.actorId }),
    ...(options.propertyId === undefined ? {} : { propertyId: options.propertyId }),
    ...(tenant?.slug === undefined ? {} : { tenantSlug: tenant.slug }),
  };

  await withTenant(ctx, (tx) =>
    tx.importJob.update({ where: { id: jobId }, data: { status: 'processing' } })
  );

  let imported = 0;
  let updated = 0;
  let errors = 0;
  let skipped = 0;

  try {
    // A dry run resolves everything against real data and writes NOTHING but its own
    // findings — see the note on `EntityProcessor.preview` for why it is a separate
    // code path rather than a flag.
    const results =
      options.dryRun === true
        ? (await processor.preview(ctx, rawRows, log)).map((row) => ({
            rowIndex: row.rowIndex,
            status:
              row.action === 'create'
                ? ('imported' as const)
                : row.action === 'update'
                  ? ('updated' as const)
                  : row.action === 'skip'
                    ? ('skipped' as const)
                    : ('error' as const),
            ...(row.naturalKey === undefined ? {} : { naturalKey: row.naturalKey }),
            ...(row.errorMsg === undefined ? {} : { errorMsg: row.errorMsg }),
          }))
        : await processor.run(
            ctx,
            rawRows,
            {
              upsert: options.upsert !== false,
              ...(options.vendor === undefined ? {} : { vendor: options.vendor }),
            },
            log
          );

    for (const result of results) {
      if (result.status === 'imported') imported++;
      else if (result.status === 'updated') updated++;
      else if (result.status === 'skipped') skipped++;
      else errors++;
    }

    // One statement instead of one per row. A 9,000-row file was 9,000 round trips,
    // which took longer than the import it was recording.
    if (results.length > 0) {
      await withTenant(ctx, (tx) =>
        tx.importJobRow.createMany({
          data: results.map((result) => ({
            jobId,
            tenantId: job.tenantId,
            rowIndex: result.rowIndex,
            status: result.status,
            naturalKey: result.naturalKey ?? null,
            errorMsg: result.errorMsg ?? null,
          })),
        })
      );
    }

    await withTenant(ctx, (tx) =>
      tx.importJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          importedCount: imported,
          updatedCount: updated,
          errorCount: errors,
          completedAt: new Date(),
        },
      })
    );

    log.info(
      { imported, updated, skipped, errors, dryRun: options.dryRun === true },
      'job completed'
    );
    return { jobId, status: 'completed', imported, updated, errors, skipped };
  } catch (err) {
    log.error({ err }, 'job run failed — marking as failed');
    await withTenant(ctx, (tx) =>
      tx.importJob.update({
        where: { id: jobId },
        data: { status: 'failed', completedAt: new Date() },
      })
    ).catch(() => undefined);
    throw err;
  }
}
