// Commerce Pub/Sub event publisher.
//
// Mirrors @sparx/auth's `publishAuthEmail` pattern: each service emits
// via this thin wrapper rather than calling @sparx/events directly so
// the package can attach an audit-log write and a consistent logger in
// one place. The actual transport is @sparx/events, which talks to
// Google Pub/Sub in prod and a noop-with-logging publisher in dev/test.

import {
  createPublisher,
  indexEntity,
  publishEvent,
  type EventType,
  type PublisherLogger,
} from '@sparx/events';

const logger: PublisherLogger = {
  info: (obj, msg) => console.log(JSON.stringify({ level: 'info', src: 'commerce', ...obj, msg })),
  warn: (obj, msg) => console.warn(JSON.stringify({ level: 'warn', src: 'commerce', ...obj, msg })),
  error: (obj, msg) =>
    console.error(JSON.stringify({ level: 'error', src: 'commerce', ...obj, msg })),
};

// Subset of EventType the Commerce module actually publishes. Narrowing
// here means a typo in a topic surfaces at compile time. Adding a new
// commerce event requires (1) extending EventType in @sparx/events and
// (2) listing it here.
export type CommerceTopic = Extract<
  EventType,
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'variant.created'
  | 'variant.updated'
  | 'variant.deleted'
  | 'variant.cost.updated'
  | 'inventory.adjusted'
  | 'inventory.low'
  | 'inventory.depleted'
  | 'cart.created'
  | 'cart.updated'
  | 'cart.abandoned'
  | 'cart.recovered'
  | 'checkout.started'
  | 'checkout.completed'
  | 'checkout.expired'
  | 'order.placed'
  | 'order.paid'
  | 'order.fulfilled'
  | 'order.delivered'
  | 'order.cancelled'
  | 'order.refunded'
  | 'order.payment_failed'
  | 'subscription.created'
  | 'subscription.renewed'
  | 'subscription.payment_failed'
  | 'subscription.paused'
  | 'subscription.resumed'
  | 'subscription.cancelled'
  | 'return.requested'
  | 'return.approved'
  | 'return.received'
  | 'return.refunded'
  | 'review.submitted'
  | 'review.published'
  | 'review.flagged'
  | 'question.published'
  | 'question.answered'
  | 'provider.installed'
  | 'provider.uninstalled'
  | 'provider.health_changed'
  | 'giftcard.issued'
  | 'giftcard.redeemed'
  | 'accountcredit.granted'
  | 'accountcredit.spent'
  | 'configuration.requested'
  | 'configuration.quoted'
  | 'configuration.accepted'
  // B2B — emitted by checkout-service when a net-terms order auto-creates an invoice
  | 'b2b.invoice.created'
  // B2B — approval workflow (docs/64 Ph6)
  | 'b2b.order.pending_approval'
  | 'b2b.order.approved'
  | 'b2b.order.rejected'
>;

export interface CommerceEventInput<T = Record<string, unknown>> {
  tenantId: string;
  actorId?: string | null;
  topic: CommerceTopic;
  data: T;
}

/**
 * Publish a Commerce event to the platform bus. Always called AFTER a
 * DB transaction commits — never inside one. A rolled-back write must
 * never emit a phantom event.
 */
export async function publishCommerceEvent<T>(input: CommerceEventInput<T>): Promise<void> {
  const publisher = createPublisher({
    projectId: process.env.GCP_PROJECT_ID,
    logger,
  });
  await publishEvent(
    publisher,
    input.topic,
    input.tenantId,
    input.actorId ?? null,
    input.data,
    logger
  );

  // Keep the universal `entities` search index live off the existing event
  // stream (docs/39 §6.1): when a commerce event names a searchable entity,
  // also emit one generic `search.entity.changed` so the indexer re-projects
  // it. No per-entity topic; reindex backfills regardless. `indexEntity` never
  // throws into the caller (transport errors are swallowed downstream).
  const target = universalTargetFor(input.topic, input.data as Record<string, unknown>);
  if (target) {
    await indexEntity({
      tenantId: input.tenantId,
      actorId: input.actorId ?? null,
      entityType: target.entityType,
      recordId: target.recordId,
    });
  }
}

/**
 * Map a commerce domain event → the universal-search entity it should reindex,
 * or null when the event isn't a searchable-entity change. The record id is
 * read from the event's `data` payload:
 *   - gift_card / subscription / return / review carry their own id field;
 *   - collection / category changes ride on `product.*` with a discriminator id;
 *   - bare `product.*` (productId only) indexes the product's lightweight
 *     universal doc, alongside its rich collection (docs/39 §4.1).
 */
function universalTargetFor(
  topic: CommerceTopic,
  data: Record<string, unknown>
): { entityType: string; recordId: string } | null {
  const str = (k: string): string | undefined =>
    typeof data[k] === 'string' ? data[k] : undefined;

  if (topic === 'giftcard.issued' || topic === 'giftcard.redeemed') {
    const id = str('giftCardId');
    return id ? { entityType: 'gift_card', recordId: id } : null;
  }
  if (topic.startsWith('subscription.')) {
    const id = str('subscriptionId');
    return id ? { entityType: 'subscription', recordId: id } : null;
  }
  if (topic.startsWith('return.')) {
    const id = str('returnId');
    return id ? { entityType: 'return', recordId: id } : null;
  }
  if (topic.startsWith('review.')) {
    const id = str('reviewId');
    return id ? { entityType: 'review', recordId: id } : null;
  }
  if (topic === 'product.created' || topic === 'product.updated' || topic === 'product.deleted') {
    const collectionId = str('collectionId');
    if (collectionId) return { entityType: 'collection', recordId: collectionId };
    const categoryId = str('categoryId');
    if (categoryId) return { entityType: 'category', recordId: categoryId };
    const productId = str('productId');
    if (productId) return { entityType: 'product', recordId: productId };
  }
  return null;
}

/**
 * Post-commit universal-search signal for commerce entities that have NO domain
 * event of their own (discount, warehouse, bundle). Same contract as
 * `publishCommerceEvent`: call AFTER the write commits; never throws into the
 * caller. `op: 'delete'` removes the doc; `'upsert'` (default) re-projects (and
 * the indexer deletes anyway if the projector reports the record is gone).
 */
export async function indexCommerceEntity(
  ctx: { tenantId: string; userId?: string | null },
  entityType: string,
  recordId: string,
  op: 'upsert' | 'delete' = 'upsert'
): Promise<void> {
  await indexEntity({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    entityType,
    recordId,
    op,
  });
}
