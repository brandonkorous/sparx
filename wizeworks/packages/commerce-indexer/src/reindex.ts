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
  computeBestSellerRanks,
  listCustomerIdsForTenant,
  listOrderIdsForTenant,
  listProductIdsForTenant,
  projectCustomers,
  projectOrders,
  projectProducts,
} from '@wizeworks/commerce';
import {
  bulkUpsertCustomers,
  bulkUpsertEntities,
  bulkUpsertOrders,
  bulkUpsertProducts,
  CUSTOMERS_COLLECTION,
  dropTenantFromCollection,
  ENTITIES_COLLECTION,
  ORDERS_COLLECTION,
  PRODUCTS_COLLECTION,
  type UniversalSearchDocument,
} from '@wizeworks/search';
import type { Logger as PinoLogger } from 'pino';

import type { CommerceEventEnvelope } from './handler.js';
import { REGISTRY } from './registry.js';

// Ids are enumerated all-at-once (cheap, id-only), then projected +
// upserted in chunks this size so a huge tenant doesn't hold every
// projected document in memory at once.
const PROJECT_CHUNK = 500;

// The three rich collections have bespoke per-collection plans; `entities` is
// the universal collection rebuilt by walking the projector registry.
export type ReindexCollection = 'products' | 'customers' | 'orders';
export type ReindexTarget = ReindexCollection | 'entities';

const ALL_COLLECTIONS: ReindexCollection[] = ['products', 'customers', 'orders'];
const ALL_TARGETS: ReindexTarget[] = [...ALL_COLLECTIONS, 'entities'];

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
  // Tenant only — NOT the actor. `event.actorId` is whoever triggered the reindex, and
  // that is not always a UUID: the wize-admin operator console sends a Better Auth staff id
  // (`rZqhan9PO1EdZEVwgRyg9OfrB9iQN9Wm`), and `withTenant` validates `userId` as a UUID for
  // the `app.user_id` RLS GUC → it threw before the first `listIds`, so an operator-triggered
  // reindex ran with `dropStale` (dropped every product doc) and then crashed WITHOUT
  // reprojecting — emptying the tenant's product search entirely. The indexer is a
  // tenant-scoped system batch reading FORCE-RLS tables keyed on `tenant_id`; it never needs
  // `app.user_id`, so don't set it. (Same fix applied to handler.ts for the real-time path.)
  const ctx = { tenantId };
  const data = (event.data ?? {}) as {
    collections?: unknown;
    dropStale?: unknown;
    runId?: unknown;
  };
  const requested = Array.isArray(data.collections)
    ? data.collections.filter((c): c is ReindexTarget =>
        (ALL_TARGETS as readonly string[]).includes(c as string)
      )
    : ALL_TARGETS;
  const dropStale = data.dropStale === true;
  const runId = typeof data.runId === 'string' ? data.runId : undefined;

  const result: ReindexResult = { runId, collections: {} };

  for (const collection of requested) {
    // The universal `entities` collection is rebuilt by walking every
    // registered projector (each entity type) — not a single plan.
    if (collection === 'entities') {
      result.collections.entities = await reindexEntities(ctx, dropStale, runId, logger);
      continue;
    }

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

/** Rebuild the universal `entities` collection for one tenant by walking every
 *  registered projector. Each projector enumerates its ids and projects in
 *  PROJECT_CHUNK batches; nulls (deleted records) are skipped. One bad row is
 *  counted, not thrown — same contract as the rich-collection plans. */
async function reindexEntities(
  ctx: ReindexCtx,
  dropStale: boolean,
  runId: string | undefined,
  logger: PinoLogger
): Promise<{ indexed: number; errors: number }> {
  if (dropStale) {
    const dropped = await dropTenantFromCollection(ENTITIES_COLLECTION, ctx.tenantId);
    logger.info(
      { tenantId: ctx.tenantId, collection: 'entities', dropped: dropped.deleted, runId },
      'reindex: dropped stale docs'
    );
  }
  let indexed = 0;
  let errors = 0;
  for (const projector of REGISTRY.values()) {
    const ids = await projector.listIdsForTenant(ctx);
    for (const idBatch of chunk(ids, PROJECT_CHUNK)) {
      const projected = await Promise.all(idBatch.map((id) => projector.project(ctx, id)));
      const docs = projected.filter((d): d is UniversalSearchDocument => d !== null);
      const res = await bulkUpsertEntities(docs);
      indexed += res.successCount;
      errors += res.errors.length;
    }
    logger.info(
      { tenantId: ctx.tenantId, entityType: projector.entityType, total: ids.length, runId },
      'reindex: entity type done'
    );
  }
  return { indexed, errors };
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
    case 'products': {
      // Best-seller ranks are tenant-wide, so compute them once and reuse the
      // memoized map across every chunk (the plan's projectAndUpsert runs per
      // chunk). The map is stamped into each product doc so the default search
      // sort (_text_match,best_seller_rank,updated_at) is meaningful.
      let ranksPromise: Promise<Map<string, number>> | null = null;
      return {
        collectionName: PRODUCTS_COLLECTION,
        listIds: (ctx) => listProductIdsForTenant(ctx),
        projectAndUpsert: async (ctx, ids) => {
          ranksPromise ??= computeBestSellerRanks(ctx);
          const ranks = await ranksPromise;
          const res = await bulkUpsertProducts(await projectProducts(ctx, ids, ranks));
          return { indexed: res.successCount, errors: res.errors.length };
        },
      };
    }
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
