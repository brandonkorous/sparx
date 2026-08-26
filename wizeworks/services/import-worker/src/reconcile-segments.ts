// Re-cut segment membership after an import.
//
// THE EVALUATOR CANNOT HEAR THIS PROCESS.
//
// `customerService.create/update` publishes `crm.customer.created/updated`, and
// the segment evaluator subscribes to exactly those — but it subscribes on an
// IN-PROCESS bus, registered by `registerCrmConsumers()` inside api-rest (and
// api-graphql / api-mcp). This worker is a different process and registers no
// consumers, so the bridge correctly finds nothing subscribed and forwards
// nothing. Nothing errors. The import succeeds, the customers are right, and
// every group they should have joined still says "No members yet".
//
// That is how a shop owner imports a mailing list of 25 people, 22 of whom said
// yes to marketing, and finds "Newsletter Subscribers" empty afterwards.
//
// Reconciling ONCE PER JOB rather than per row is also the cheaper shape: a
// 9,000-row file would otherwise evaluate every segment 9,000 times.

import type { Logger } from 'pino';
import { segmentService } from '@wizeworks/crm';

/** Entities whose rows feed a segment rule's projection: the customer's own
 *  fields, their order rollups, and their B2B account. Importing anything else
 *  cannot change who belongs to a group. */
const AFFECTS_SEGMENTS = new Set(['customers', 'orders', 'companies', 'b2b_accounts']);

export function importAffectsSegments(entityType: string): boolean {
  return AFFECTS_SEGMENTS.has(entityType);
}

/**
 * Reconcile every dynamic segment for the tenant, once, after a real import.
 *
 * Never throws: the import itself has already succeeded and its rows are
 * written, so a failure to re-cut groups must not mark the job failed or
 * trigger a redelivery that would import everything a second time. It IS
 * logged at error, and the nightly `crm-segment-recompute` CronJob plus the
 * "Update all" action on the groups list are both still there behind it.
 */
export async function reconcileSegmentsAfterImport(
  args: { tenantId: string; entityType: string; dryRun: boolean },
  log: Logger
): Promise<void> {
  if (args.dryRun) return;
  if (!importAffectsSegments(args.entityType)) return;

  try {
    const { scanned, changed } = await segmentService.recomputeFull({
      tenantId: args.tenantId,
      userId: undefined,
    });
    log.info({ scanned, changed }, 'segments reconciled after import');
  } catch (err) {
    log.error({ err }, 'could not reconcile segments after import');
  }
}
