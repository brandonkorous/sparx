// Event router. Maps each commerce event type to either a product
// reprojection, a collection reprojection, or both. The router is
// idempotent — receiving the same event twice produces the same final
// state in Typesense.

import {
  projectAllCollectionRulesForTenant,
  projectCollectionRules,
  projectCustomer,
  projectOrder,
  projectProduct,
} from '@sparx/commerce';
import {
  deleteCustomer,
  deleteEntity,
  deleteOrder,
  deleteProduct,
  upsertCustomer,
  upsertEntity,
  upsertOrder,
  upsertProduct,
} from '@sparx/search';
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
  const ctx = { tenantId, userId: event.actorId ?? undefined };

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
          const diff = await projectCollectionRules(ctx, collectionId);
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
        logger.info({ tenantId, productId }, 'product not found; deleted from index');
        return { outcome: 'deleted', details: { productId } };
      }
      await upsertProduct(document);
      // A product write can also affect rule-driven collection memberships.
      // Cheaper than recompiling every tenant collection: only re-run when
      // the event is `product.created/updated` (variant pings tend to be
      // identity-preserving on the product face). The reprojection itself
      // is fast for the typical tenant (<50 rules-driven collections).
      let reprojection: unknown = undefined;
      if (event.type === 'product.created' || event.type === 'product.updated') {
        const diffs = await projectAllCollectionRulesForTenant(ctx);
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

    // ── Orders (order.* — the platform bus, teed to Pub/Sub) ──
    case 'order.created':
    case 'order.cancelled':
    case 'order.payment.recorded':
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

function stringProp(data: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = data?.[key];
  return typeof v === 'string' ? v : undefined;
}

function stringArrayProp(data: Record<string, unknown> | undefined, key: string): string[] {
  const v = data?.[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}
