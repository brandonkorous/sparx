// Import-worker message handler.
//
// Flow:
//   1. Parse the import.job.created Pub/Sub event payload.
//   2. Load the ImportJob (including rawRows) from the DB.
//   3. Dispatch to the entity-specific processor.
//   4. Write per-row ImportJobRow records and update job counts.
//   5. Mark job as completed (or failed if the run itself errored).
//
// Failure model:
//   - Per-row validation/service errors: row written with status='error';
//     job continues; job.error_count increments. No nack.
//   - Job not found / DB unavailable: throw; caller nacks → redelivery.
//   - Unknown entity type: ack with a 'failed' status on the job.

import type { Logger } from 'pino';
import { z } from 'zod';
import { prisma, withTenant } from '@sparx/db';

import { processProductRows } from './processors/products.js';
import { processCustomerRows } from './processors/customers.js';

const ImportJobCreatedPayload = z.object({
  jobId: z.string().uuid(),
  entityType: z.enum(['products', 'customers', 'b2b_accounts', 'discounts']),
});

export interface HandleOutcome {
  jobId: string;
  status: 'completed' | 'failed' | 'unknown_job';
  imported: number;
  updated: number;
  errors: number;
}

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

  // Load the job to get tenantId + rawRows.
  const job = await prisma.importJob.findFirst({ where: { id: jobId } });
  if (!job) {
    log.warn('job not found — may have been deleted; acking');
    return { jobId, status: 'unknown_job', imported: 0, updated: 0, errors: 0 };
  }

  const tenantId = job.tenantId;
  const ctx = { tenantId };
  const rawRows = job.rawRows as Record<string, string>[];
  const upsert = (job.options as { upsert?: boolean })?.upsert !== false;

  // Mark as processing.
  await withTenant(ctx, (tx) =>
    tx.importJob.update({ where: { id: jobId }, data: { status: 'processing' } })
  );

  let imported = 0;
  let updated = 0;
  let errors = 0;

  try {
    if (entityType === 'products') {
      const results = await processProductRows(ctx, rawRows, { upsert }, log);
      for (const r of results) {
        if (r.status === 'imported') imported++;
        else if (r.status === 'updated') updated++;
        else errors++;
        await withTenant(ctx, (tx) =>
          tx.importJobRow.create({
            data: {
              jobId,
              tenantId,
              rowIndex: r.rowIndex,
              status: r.status,
              naturalKey: r.naturalKey ?? null,
              errorMsg: r.errorMsg ?? null,
            },
          })
        );
      }
    } else if (entityType === 'customers') {
      const results = await processCustomerRows(ctx, rawRows, { upsert }, log);
      for (const r of results) {
        if (r.status === 'imported') imported++;
        else if (r.status === 'updated') updated++;
        else errors++;
        await withTenant(ctx, (tx) =>
          tx.importJobRow.create({
            data: {
              jobId,
              tenantId,
              rowIndex: r.rowIndex,
              status: r.status,
              naturalKey: r.naturalKey ?? null,
              errorMsg: r.errorMsg ?? null,
            },
          })
        );
      }
    } else {
      log.warn({ entityType }, 'unsupported entity type — marking job failed');
      await withTenant(ctx, (tx) =>
        tx.importJob.update({
          where: { id: jobId },
          data: {
            status: 'failed',
            errorCount: rawRows.length,
            completedAt: new Date(),
          },
        })
      );
      return { jobId, status: 'failed', imported: 0, updated: 0, errors: rawRows.length };
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

    log.info({ imported, updated, errors }, 'job completed');
    return { jobId, status: 'completed', imported, updated, errors };
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
