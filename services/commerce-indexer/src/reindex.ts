// Full-tenant reindex. Triggered by the `search.reindex.requested` event
// (published by api-rest's POST /v1/search/reindex). Rebuilds one tenant's
// search collections from Postgres: enumerate ids → project in bounded
// chunks → bulk-upsert. Used for first population, schema bumps, and
// recovery from sync drift.
//
// Runs in the worker (not inline in api-rest) so a large catalog can't time
// out an HTTP request; the worker has the admin Typesense key, the Prisma
// reader, and scales to zero between runs.

import {
  listCustomerIdsForTenant,
  listOrderIdsForTenant,
  listProductIdsForTenant,
  projectCustomers,
  projectOrders,
  projectProducts,
} from '@sparx/commerce';
import {
  bulkUpsertCustomers,
  bulkUpsertOrders,
  bulkUpsertProducts,
  CUSTOMERS_COLLECTION,
  dropTenantFromCollection,
  ORDERS_COLLECTION,
  PRODUCTS_COLLECTION,
} from '@sparx/search';
import type { Logger as PinoLogger } from 'pino';

import type { CommerceEventEnvelope } from './handler.js';

// Ids are enumerated all-at-once (cheap, id-only), then projected +
// upserted in chunks this size so a huge tenant doesn't hold every
// projected document in memory at once.
const PROJECT_CHUNK = 500;

export type ReindexCollection = 'products' | 'customers' | 'orders';

const ALL_COLLECTIONS: ReindexCollection[] = ['products', 'customers', 'orders'];

export interface ReindexResult {
  runId?: string;
  collections: Record<string, { indexed: number; errors: number }>;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Reindex one tenant. `event.data` may carry:
 *   - collections?: string[]  — subset to rebuild (default: all three)
 *   - dropStale?: boolean      — wipe the tenant's docs before reloading
 *                                (clean slate; brief empty window per collection)
 *   - runId?: string           — correlation id echoed back for logs
 * Throws on a fatal error so Pub/Sub retries → DLQ; per-document import
 * failures are counted, not thrown (one bad row shouldn't fail the run).
 */
export async function runReindex(
  event: CommerceEventEnvelope,
  logger: PinoLogger
): Promise<ReindexResult> {
  const tenantId = event.tenantId;
  if (!tenantId) {
    throw new Error('search.reindex.requested missing tenantId');
  }
  const ctx = { tenantId, userId: event.actorId ?? undefined };
  const data = (event.data ?? {}) as {
    collections?: unknown;
    dropStale?: unknown;
    runId?: unknown;
  };
  const requested = Array.isArray(data.collections)
    ? data.collections.filter((c): c is ReindexCollection =>
        (ALL_COLLECTIONS as readonly string[]).includes(c as string)
      )
    : ALL_COLLECTIONS;
  const dropStale = data.dropStale === true;
  const runId = typeof data.runId === 'string' ? data.runId : undefined;

  const result: ReindexResult = { runId, collections: {} };

  for (const collection of requested) {
    const plan = planFor(collection);

    if (dropStale) {
      const dropped = await dropTenantFromCollection(plan.collectionName, tenantId);
      logger.info(
        { tenantId, collection, dropped: dropped.deleted, runId },
        'reindex: dropped stale docs'
      );
    }

    const ids = await plan.listIds(ctx);
    let indexed = 0;
    let errors = 0;
    for (const idBatch of chunk(ids, PROJECT_CHUNK)) {
      const out = await plan.projectAndUpsert(ctx, idBatch);
      indexed += out.indexed;
      errors += out.errors;
    }
    result.collections[collection] = { indexed, errors };
    logger.info(
      { tenantId, collection, indexed, errors, total: ids.length, runId },
      'reindex: collection done'
    );
  }

  return result;
}

interface ReindexCtx {
  tenantId: string;
  userId?: string;
}

interface CollectionPlan {
  collectionName: string;
  listIds: (ctx: ReindexCtx) => Promise<string[]>;
  projectAndUpsert: (
    ctx: ReindexCtx,
    ids: string[]
  ) => Promise<{ indexed: number; errors: number }>;
}

// Arrow-function wrappers (not bare references) so the projection/list
// functions stay `this`-free closures — keeps the lint unbound-method rule
// happy and the call sites uniform across collections.
function planFor(collection: ReindexCollection): CollectionPlan {
  switch (collection) {
    case 'products':
      return {
        collectionName: PRODUCTS_COLLECTION,
        listIds: (ctx) => listProductIdsForTenant(ctx),
        projectAndUpsert: async (ctx, ids) => {
          const res = await bulkUpsertProducts(await projectProducts(ctx, ids));
          return { indexed: res.successCount, errors: res.errors.length };
        },
      };
    case 'customers':
      return {
        collectionName: CUSTOMERS_COLLECTION,
        listIds: (ctx) => listCustomerIdsForTenant(ctx),
        projectAndUpsert: async (ctx, ids) => {
          const res = await bulkUpsertCustomers(await projectCustomers(ctx, ids));
          return { indexed: res.successCount, errors: res.errors.length };
        },
      };
    case 'orders':
      return {
        collectionName: ORDERS_COLLECTION,
        listIds: (ctx) => listOrderIdsForTenant(ctx),
        projectAndUpsert: async (ctx, ids) => {
          const res = await bulkUpsertOrders(await projectOrders(ctx, ids));
          return { indexed: res.successCount, errors: res.errors.length };
        },
      };
  }
}
