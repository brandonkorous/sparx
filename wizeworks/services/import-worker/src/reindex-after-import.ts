// Put an import's rows into search once the import has landed.
//
// THE SEARCH INDEXER CANNOT HEAR THIS PROCESS EITHER, for the reason
// ./reconcile-segments gives: `customerService.create` announces on an
// in-process bus that only api-rest listens to. Gillett imported 30 Shopify
// customers and the search box said "30 customers are not in this box yet, so
// it cannot look at them", with a "Put them back" button for the owner to press
// (sparx persona issue 107). The box was right; he should not have had to.
//
// So a real import asks for the same rebuild that button asks for, once per
// job, for the collections its rows live in plus the universal one behind
// Search everything. One rebuild per job rather than an event per row, for the
// same reason segments are re-cut once.

import type { Logger } from 'pino';
import { createPublisher, publishEvent } from '@wizeworks/events';

type Collection = 'products' | 'customers' | 'orders' | 'entities';

/** The search collections an import of this kind of row changes. */
export function collectionsFor(entityType: string): Collection[] {
  switch (entityType) {
    case 'products':
    case 'inventory_levels':
      return ['products', 'entities'];
    case 'customers':
      return ['customers', 'entities'];
    case 'orders':
      // An order changes its customer's totals too.
      return ['orders', 'customers', 'entities'];
    default:
      return ['entities'];
  }
}

/**
 * Ask for the rebuild after a real import that wrote something.
 *
 * Never throws: the rows are written and the job has succeeded, so a failure
 * here must not mark it failed or trigger a redelivery that imports the file
 * again. The search box still offers "Put them back" behind it.
 */
export async function reindexSearchAfterImport(
  job: { tenantId: string; entityType: string; dryRun: boolean; written: number },
  logger: Logger
): Promise<void> {
  if (job.dryRun || job.written === 0) return;
  try {
    const publisher = createPublisher({ logger });
    await publishEvent(
      publisher,
      'search.reindex.requested',
      job.tenantId,
      null,
      {
        runId: `import_${crypto.randomUUID().replace(/-/g, '')}`,
        collections: collectionsFor(job.entityType),
        dropStale: false,
      },
      logger
    );
  } catch (err) {
    logger.error({ err, tenantId: job.tenantId }, 'search rebuild after import was not requested');
  }
}
