// Asking the search worker to rebuild one business's index from its real rows.

import crypto from 'node:crypto';

import type { FastifyBaseLogger } from 'fastify';
import { publish } from '@wizeworks/api-core/pubsub';

/**
 * Ask the search worker to rebuild this tenant's index from its real records.
 *
 * For writers that put many rows down in one bulk transaction and announce none
 * of them one at a time: the sample-data engine and the signup furnish that
 * runs it. Without this the console's search box answered "Nothing in your
 * records matches" about sample customers in plain view (sparx persona issue
 * 086), and every business made at signup opened its search box on "101
 * products, 7 customers and 10 orders are not in this box yet" (Piggles persona
 * issue 935), because only the console's own Load button asked.
 *
 * `dropStale` drops the tenant's entries first, for a clear: a rebuild from what
 * is left cannot remove an entry for a row that is gone. Never throws, so it
 * never fails the write it follows; the search box's own "Put them back" still
 * heals a missed rebuild.
 */
export async function requestSearchRebuild(
  logger: FastifyBaseLogger,
  tenantId: string,
  actorId: string | null,
  dropStale: boolean
): Promise<void> {
  try {
    await publish(logger, 'search.reindex.requested', tenantId, actorId, {
      runId: `reindex_${crypto.randomUUID().replace(/-/g, '')}`,
      dropStale,
    });
  } catch (err) {
    logger.error({ err, tenantId }, 'search rebuild request failed');
  }
}
