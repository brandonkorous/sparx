// Event router. Maps each commerce event type to either a product
// reprojection, a collection reprojection, or both. The router is
// idempotent — receiving the same event twice produces the same final
// state in Typesense.

import {
  marketService,
  projectAllCollectionRulesForTenant,
  projectCollectionRules,
  projectCustomer,
  projectOrder,
  projectProduct,
} from '@wizeworks/commerce';
import {
  deleteCustomer,
  deleteEntity,
  deleteOrder,
  deleteProduct,
  upsertCustomer,
  upsertEntity,
  upsertOrder,
  upsertProduct,
} from '@wizeworks/search';
import type { Logger as PinoLogger } from 'pino';

import { runReindex } from './reindex.js';
import { REGISTRY } from './registry.js';

export interface CommerceEventEnvelope {
  type: string;
  tenantId?: string;
  actorId?: string | null;
  occurredAt?: string;
  data?: Record<string, unknown>;
}

interface HandleResult {
  outcome: 'indexed' | 'deleted' | 'reprojected' | 'reindexed' | 'skipped';
  details?: Record<string, unknown>;
}

/**
 * Route one event. Throws to nack only when a transient error makes the
 * message worth retrying; logical failures (product no longer exists,
 * unknown event type) are skips, not retries.
 */
export async function handleEvent(
  event: CommerceEventEnvelope,
  logger: PinoLogger
): Promise<HandleResult> {
  const tenantId = event.tenantId;
  if (!tenantId) {
    logger.warn({ type: event.type }, 'event missing tenantId; skipping');
    return { outcome: 'skipped' };
  }
  // Tenant only — NOT the actor. `event.actorId` can be a non-UUID (a wize-admin operator id,
  // for instance), and `withTenant` validates `userId` as a UUID for the `app.user_id` GUC, so
  // mapping actor→userId is a latent crash on any non-UUID actor. The indexer reads FORCE-RLS
  // tables keyed on `tenant_id` and never needs `app.user_id`. (See reindex.ts for the case
  // where this actually fired and emptied the product index.)
  const ctx = { tenantId };

  switch (event.type) {
    case 'product.created':
    case 'product.updated':
    case 'variant.created':
    case 'variant.updated':
    case 'variant.deleted':
    case 'inventory.adjusted':
    case 'inventory.low':
    case 'inventory.depleted': {
      const productId = stringProp(event.data, 'productId');
      if (!productId) {
        // collectionService publishes 'product.updated' on collection
        // create/edit with { collectionId, change } and no productId —
        // treat that as a rules-projection trigger.
        const collectionId = stringProp(event.data, 'collectionId');
        if (collectionId) {
          const diff = await projectCollectionRules(ctx, collectionId, logger);
          for (const id of [...diff.added, ...diff.removed]) {
            const { document } = await projectProduct(ctx, id);
            if (document) await upsertProduct(document);
          }
          return { outcome: 'reprojected', details: { ...diff } };
        }
        logger.warn({ type: event.type }, 'event missing productId/collectionId; skipping');
        return { outcome: 'skipped' };
      }
      const { document } = await projectProduct(ctx, productId);
      if (!document) {
        await deleteProduct(tenantId, productId);
        await refreshMarketListing(ctx, productId, logger);
        logger.info({ tenantId, productId }, 'product not found; deleted from index');
        return { outcome: 'deleted', details: { productId } };
      }
      await upsertProduct(document);
      // sparx.market (docs/106 §4.7): keep the global market_listings projection
      // fresh for background drift — a listed product's title/price/image edit
      // (product.updated) or stock change (inventory.adjusted) re-projects the
      // card. Best-effort: a market refresh failure must NOT nack the search index
      // (opt-in itself projects synchronously in api-rest; this is the refresher).
      await refreshMarketListing(ctx, productId, logger);
      // A product write can also affect rule-driven collection memberships.
      // Cheaper than recompiling every tenant collection: only re-run when
      // the event is `product.created/updated` (variant pings tend to be
      // identity-preserving on the product face). The reprojection itself
      // is fast for the typical tenant (<50 rules-driven collections).
      let reprojection: unknown = undefined;
      if (event.type === 'product.created' || event.type === 'product.updated') {
        const diffs = await projectAllCollectionRulesForTenant(ctx, logger);
        const meaningful = diffs.filter((d) => d.added.length > 0 || d.removed.length > 0);
        if (meaningful.length > 0) {
          reprojection = meaningful;
          // Reproject the changed product again — rule membership lives
          // in CollectionProduct, which the search projection reads. A
          // second pass picks up new collection_ids for the index.
          const { document: refreshed } = await projectProduct(ctx, productId);
          if (refreshed) await upsertProduct(refreshed);
        }
      }
      return {
        outcome: 'indexed',
        details: { productId, reprojection },
      };
    }

    case 'product.deleted': {
      const productId = stringProp(event.data, 'productId');
      if (!productId) return { outcome: 'skipped' };
      await deleteProduct(tenantId, productId);
      await refreshMarketListing(ctx, productId, logger);
      return { outcome: 'deleted', details: { productId } };
    }

    // ── Customers (crm.customer.* — the CRM bus, bridged to Pub/Sub) ──
    case 'crm.customer.created':
    case 'crm.customer.updated': {
      const customerId = stringProp(event.data, 'customerId');
      if (!customerId) {
        logger.warn({ type: event.type }, 'customer event missing customerId; skipping');
        return { outcome: 'skipped' };
      }
      const { document } = await projectCustomer(ctx, customerId);
      if (!document) {
        // Soft-deleted between publish and processing — remove from index.
        await deleteCustomer(tenantId, customerId);
        return { outcome: 'deleted', details: { customerId } };
      }
      await upsertCustomer(document);
      return { outcome: 'indexed', details: { customerId } };
    }

    case 'crm.customer.deleted': {
      const customerId = stringProp(event.data, 'customerId');
      if (!customerId) return { outcome: 'skipped' };
      await deleteCustomer(tenantId, customerId);
      return { outcome: 'deleted', details: { customerId } };
    }

    case 'crm.customer.merged': {
      // merge-service emits { primaryCustomerId, duplicateCustomerIds[] }.
      // The losers are soft-deleted → drop them; the survivor absorbed their
      // stats → re-project + upsert it.
      const primaryId = stringProp(event.data, 'primaryCustomerId');
      const duplicateIds = stringArrayProp(event.data, 'duplicateCustomerIds');
      for (const dupId of duplicateIds) {
        await deleteCustomer(tenantId, dupId);
      }
      if (primaryId) {
        const { document } = await projectCustomer(ctx, primaryId);
        if (document) await upsertCustomer(document);
        else await deleteCustomer(tenantId, primaryId);
      }
      return { outcome: 'indexed', details: { primaryId, merged: duplicateIds.length } };
    }

    // ── Orders (order.* — the platform bus) ──
    //
    // TWO OF THESE USED TO NAME EVENTS THAT DO NOT EXIST. The list read
    // `order.created` and `order.payment.recorded`; the catalog's types are
    // `order.placed` and `order.paid` (wizeworks/packages/events/src/types.ts,
    // and CLAUDE.md says in as many words that there is no `order.created`).
    //
    // A `case` for an event nobody publishes is dead code that looks like
    // coverage, and the parity check does not see it — `check:events` compares
    // the EventType union against topics, not against the handlers that claim to
    // route them. So the four surviving cases were all LATER lifecycle events,
    // and an order entered the search index for the first time only when it was
    // cancelled, fulfilled, delivered or refunded.
    //
    // Which means the one moment an order most needs to be findable — just
    // placed, customer on the phone about it — was the one moment it was not
    // there. Searching a real order number in the console answered "Nothing
    // matches that", while the activity bar in the same window said the checkout
    // had completed on it sixteen minutes earlier.
    case 'order.placed':
    case 'order.paid':
    case 'order.cancelled':
    case 'order.fulfilled':
    case 'order.delivered':
    case 'order.refunded': {
      const orderId = stringProp(event.data, 'orderId');
      if (!orderId) {
        logger.warn({ type: event.type }, 'order event missing orderId; skipping');
        return { outcome: 'skipped' };
      }
      const { document } = await projectOrder(ctx, orderId);
      if (!document) {
        await deleteOrder(tenantId, orderId);
        return { outcome: 'deleted', details: { orderId } };
      }
      await upsertOrder(document);
      return { outcome: 'indexed', details: { orderId } };
    }

    // ── Universal `entities` collection (docs/39) ──
    // Generic indexing signal any module emits post-commit. Dispatch by
    // entity_type to the projector registry; re-project + upsert (or delete
    // when the projector reports the record is gone).
    case 'search.entity.changed': {
      const entityType = stringProp(event.data, 'entityType');
      const recordId = stringProp(event.data, 'recordId');
      const op = stringProp(event.data, 'op') ?? 'upsert';
      if (!entityType || !recordId) {
        logger.warn(
          { type: event.type },
          'search.entity.changed missing entityType/recordId; skipping'
        );
        return { outcome: 'skipped' };
      }
      const projector = REGISTRY.get(entityType);
      if (!projector) {
        logger.warn({ type: event.type, entityType }, 'no projector for entity_type; skipping');
        return { outcome: 'skipped' };
      }
      if (op === 'delete') {
        await deleteEntity(tenantId, entityType, recordId);
        return { outcome: 'deleted', details: { entityType, recordId } };
      }
      const doc = await projector.project(ctx, recordId);
      if (!doc) {
        await deleteEntity(tenantId, entityType, recordId);
        return { outcome: 'deleted', details: { entityType, recordId } };
      }
      await upsertEntity(doc);
      return { outcome: 'indexed', details: { entityType, recordId } };
    }

    case 'search.reindex.requested': {
      const summary = await runReindex(event, logger);
      return { outcome: 'reindexed', details: { ...summary } };
    }

    default:
      logger.debug({ type: event.type }, 'event type not routed; skipping');
      return { outcome: 'skipped' };
  }
}

/** Best-effort refresh of a product's sparx.market listing projection (docs/106
 *  §4.7). projectMarketListing upserts the listing when the product is eligible and
 *  removes it otherwise — so it self-corrects on un-list / archive / out-of-category.
 *  Never throws: market freshness must not nack the (primary) search index write. */
async function refreshMarketListing(
  ctx: { tenantId: string; userId?: string },
  productId: string,
  logger: PinoLogger
): Promise<void> {
  try {
    await marketService.projectMarketListing(ctx, productId);
  } catch (err) {
    logger.warn({ err, productId }, 'market listing projection failed (best-effort); continuing');
  }
}

function stringProp(data: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = data?.[key];
  return typeof v === 'string' ? v : undefined;
}

function stringArrayProp(data: Record<string, unknown> | undefined, key: string): string[] {
  const v = data?.[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}
