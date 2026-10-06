// Event router. Maps each commerce event type to either a product
// reprojection, a collection reprojection, or both. The router is
// idempotent — receiving the same event twice produces the same final
// state in Typesense.

import {
  marketService,
  projectAllCollectionRulesForTenant,
  projectCollectionRules,
  projectInventoryCollectionRulesForTenant,
  listCustomerIdsForAccount,
  listOrderIdsForAccount,
  listOrderIdsForBillingDocument,
  listOrderIdsForCustomer,
  projectCustomer,
  projectOrder,
  projectOrders,
  projectProduct,
  productIdForVariant,
} from '@wizeworks/commerce';
import {
  bulkUpsertOrders,
  type CustomerSearchDocument,
  deleteCustomer,
  deleteEntity,
  deleteOrder,
  deleteProduct,
  getCustomerDocument,
  getEntity,
  upsertCustomer,
  upsertEntity,
  upsertOrder,
  upsertProduct,
} from '@wizeworks/search';
import type { Logger as PinoLogger } from 'pino';

import { runReindex } from './reindex.js';
import { REGISTRY } from './registry.js';
import { SAME_ROW } from './same-row.js';

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
      // collectionService publishes 'product.updated' on collection
      // create/edit with { collectionId, change } and no productId —
      // treat that as a rules-projection trigger.
      const collectionId = stringProp(event.data, 'collectionId');
      if (collectionId && !stringProp(event.data, 'productId')) {
        const diff = await projectCollectionRules(ctx, collectionId, logger);
        for (const id of [...diff.added, ...diff.removed]) {
          const { document } = await projectProduct(ctx, id);
          if (document) await upsertProduct(document);
        }
        return { outcome: 'reprojected', details: { ...diff } };
      }
      // MOST OF THESE EVENTS DO NOT CARRY A productId, and this branch used to
      // give up when one was missing. Every `inventory.*` event is variant-keyed
      // (stock is counted per variant per warehouse), and six `variant.*` writes
      // publish only `{ variantId, change }` — sku, isDefault, optionValues,
      // archive, restore. So the whole variant-and-stock half of this handler
      // logged "missing productId; skipping" and did nothing: selling the last
      // unit left the product in the index as in-stock, renaming a SKU left the
      // old one searchable, and rule-driven collections never reprojected at
      // all, which is how a live shop's "Last chance" shelf stayed empty while
      // its own console said a size had run out (issue 370).
      //
      // The variant is the thing that changed; the product is what gets indexed.
      // Bridging the two is one read, here, once per event.
      const productId = await resolveProductId(ctx, event, logger);
      if (!productId) return { outcome: 'skipped' };
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
      // Rule-driven collection membership, which this write can also change.
      //
      // A product write can change any rule field, so it re-runs every rule. An
      // inventory write can change exactly two — `inStock` and `lowStock`, which
      // are product-face columns AND rule predicates (`in_stock`,
      // `out_of_stock`, `low_stock`) — so it re-runs only the collections that
      // ask about stock. For most tenants that is none, and it is never all of
      // them, which was the cost objection behind re-running on product writes
      // alone.
      let reprojection: unknown = undefined;
      {
        const diffs =
          event.type === 'product.created' || event.type === 'product.updated'
            ? await projectAllCollectionRulesForTenant(ctx, logger)
            : await projectInventoryCollectionRulesForTenant(ctx, logger);
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
    //
    // `captured` and `subscribed` are new people too, arriving from the site
    // rather than from somebody's keyboard, and they carry the same `customerId`
    // (sparx persona issue 086).
    case 'crm.customer.created':
    case 'crm.customer.updated':
    case 'crm.customer.captured':
    case 'crm.customer.subscribed': {
      const customerId = stringProp(event.data, 'customerId');
      if (!customerId) {
        logger.warn({ type: event.type }, 'customer event missing customerId; skipping');
        return { outcome: 'skipped' };
      }
      // Soft-deleted between publish and processing comes back 'deleted'. Their
      // orders follow when the write moved anything those documents copy.
      const outcome = await reindexCustomer(ctx, customerId, false, true);
      return { outcome, details: { customerId } };
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
        // The merge moved the duplicates' orders onto the survivor, and a SQL
        // move raises no order event, so their documents still named the
        // duplicate: their buyer, their account. Every order the survivor now
        // holds is re-read. A merge is rare and deliberate, so this is not gated.
        await reindexOrders(ctx, await listOrderIdsForCustomer(ctx, primaryId));
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
    //
    // An order held for sign-off publishes `b2b.order.pending_approval`
    // INSTEAD of `order.placed`, and turning it down publishes
    // `b2b.order.rejected` instead of `order.cancelled`. Without these two, a
    // held order could not be found by its number while it waited for
    // somebody to sign it off, and a rejected one never could (sparx persona
    // issue 086). Approving one already publishes `order.placed`.
    case 'order.placed':
    case 'order.paid':
    case 'order.cancelled':
    case 'order.fulfilled':
    case 'order.delivered':
    case 'order.refunded':
    case 'b2b.order.pending_approval':
    case 'b2b.order.rejected': {
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
    // `b2b.invoice.created` rides the same path. A wholesale receivable IS a
    // BillingDocument on the `net-terms-ar` workflow, with the same id — so the
    // generic projector already knows how to index one, and this topic is just
    // a second name for "a billing document now exists".
    //
    // It is here because indexing a billing document otherwise happens at the
    // ROUTE layer, in api-rest's invoicing/documents.ts, and NONE of the three
    // publishers of this topic goes through that file: the wholesale Raise an
    // invoice route, a sign-off being approved, and a checkout placed on terms.
    // MEASURED 2026-09-20: a $120 invoice raised for a shop that morning could
    // not be found by its number four minutes later, while every invoice raised
    // on the Invoices screen could. [[feedback_a_fix_leaves_its_neighbour_behind]]
    case 'b2b.invoice.created':
    case 'search.entity.changed': {
      const wholesaleInvoice = event.type === 'b2b.invoice.created';
      const entityType = wholesaleInvoice
        ? 'billing_document'
        : stringProp(event.data, 'entityType');
      const recordId = wholesaleInvoice
        ? stringProp(event.data, 'invoiceId')
        : stringProp(event.data, 'recordId');
      const op = wholesaleInvoice ? 'upsert' : (stringProp(event.data, 'op') ?? 'upsert');
      if (!entityType || !recordId) {
        logger.warn(
          { type: event.type },
          'indexing event missing the entity it is about; skipping'
        );
        return { outcome: 'skipped' };
      }
      // A CUSTOMER lives in its own rich collection, not in `entities`, so it has
      // no projector in the registry. It still has to be re-read when something
      // that is not the customer row changes what its document says: being added
      // to or switched off a trade account's contact list writes only a
      // `b2b_account_contacts` row, and the customer's document carries that
      // account's name (see `companyWords` in @wizeworks/commerce). Without this
      // branch the signal was dropped as "no projector", and a contact added on
      // the account's screen could not be found by the account's name until
      // somebody happened to edit them (Gillett Diesel, 2026-10-03).
      if (entityType === 'customer') {
        const outcome = await reindexCustomer(ctx, recordId, op === 'delete', true);
        return { outcome, details: { customerId: recordId } };
      }
      if (!REGISTRY.get(entityType)) {
        logger.warn({ type: event.type, entityType }, 'no projector for entity_type; skipping');
        return { outcome: 'skipped' };
      }
      // An account's orders carry its name too (see `orderAccount` in
      // @wizeworks/commerce), so a renamed or removed account re-reads them. Only
      // then: routine account writes (a credit limit, a terms change, the daily
      // near-the-limit signal) leave the name alone and would otherwise re-read
      // every order the account ever placed. This runs BEFORE the account's own
      // entry is overwritten, because that entry is how the change is seen: if
      // re-reading the orders fails, the redelivered event still sees the old
      // name and tries again.
      if (entityType === 'b2b_account' && (await accountNameMoved(ctx, recordId, op))) {
        await reindexOrders(ctx, await listOrderIdsForAccount(ctx, recordId));
      }
      // Every kind read from this row, not just the one the event named: the
      // kind the row IS gets indexed, and any other kind gets its stale entry
      // deleted. See SAME_ROW.
      let indexedAs: string | null = null;
      for (const kind of SAME_ROW[entityType] ?? [entityType]) {
        const projector = REGISTRY.get(kind);
        if (!projector) continue;
        const doc = op === 'delete' ? null : await projector.project(ctx, recordId);
        if (doc) {
          await upsertEntity(doc);
          indexedAs = kind;
        } else {
          await deleteEntity(tenantId, kind, recordId);
        }
      }
      // Every person on a trade account carries the account's name in their own
      // document, so a renamed or removed account has to take those documents
      // with it. Otherwise typing the new name finds the account and none of its
      // people, and the old name goes on finding people of a business that is
      // gone.
      // A quote or invoice can be where an order takes its account from (the
      // account it was quoted or invoiced to), so the order it bills, or the one
      // it became, is re-read with it. An invoice raised on an order that was
      // filed under the buyer's pricing account moves it to the invoiced one.
      if (entityType === 'billing_document' || entityType === 'quote') {
        await reindexOrders(ctx, await listOrderIdsForBillingDocument(ctx, recordId));
      }
      if (entityType === 'b2b_account') {
        const customerIds = await listCustomerIdsForAccount(ctx, recordId);
        for (const customerId of customerIds) {
          // Their orders were re-read above when the name moved; not again here.
          await reindexCustomer(ctx, customerId, false, false);
        }
      }
      return indexedAs
        ? { outcome: 'indexed', details: { entityType: indexedAs, recordId } }
        : { outcome: 'deleted', details: { entityType, recordId } };
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

/** Re-read one customer into the customers collection: upserted when the row is
 *  live, deleted when it is gone or the signal says so.
 *
 *  `ordersFollow`: each of their order documents copies their name, email and
 *  account, so when the write moved one of those their orders are re-read too.
 *  Before the customer's own document is overwritten, because that document is
 *  how the change is seen; a failure leaves it as it was for the retry. */
async function reindexCustomer(
  ctx: { tenantId: string },
  customerId: string,
  remove: boolean,
  ordersFollow: boolean
): Promise<'indexed' | 'deleted'> {
  const { document } = remove ? { document: null } : await projectCustomer(ctx, customerId);
  if (!document) {
    await deleteCustomer(ctx.tenantId, customerId);
    return 'deleted';
  }
  if (ordersFollow && (await orderWordsMoved(ctx.tenantId, document))) {
    await reindexOrders(ctx, await listOrderIdsForCustomer(ctx, customerId));
  }
  await upsertCustomer(document);
  return 'indexed';
}

/**
 * Whether a customer write changed anything their order documents copy: the
 * name, the email, the pricing account, or the employer they typed. Compared
 * with the document search holds now, so the many writes that touch none of
 * these (a tag, a phone number, the order counters every checkout bumps) re-read
 * no orders. No document yet counts as changed: a new customer has no orders to
 * read, and one missing from search may have orders that are stale.
 */
async function orderWordsMoved(tenantId: string, next: CustomerSearchDocument): Promise<boolean> {
  const before = await getCustomerDocument(tenantId, next.customer_id);
  if (!before) return true;
  return (
    before.full_name !== next.full_name ||
    before.email !== next.email ||
    before.b2b_account_id !== next.b2b_account_id ||
    before.company !== next.company
  );
}

/**
 * Whether an account signal changes the NAME its orders answer to: renamed,
 * removed, or not in search yet. Compares the account's entry in search with
 * what the account projects to now.
 */
async function accountNameMoved(
  ctx: { tenantId: string },
  accountId: string,
  op: string
): Promise<boolean> {
  const before = await getEntity(ctx.tenantId, 'b2b_account', accountId);
  const projector = REGISTRY.get('b2b_account');
  const after = op === 'delete' || !projector ? null : await projector.project(ctx, accountId);
  return (before?.title ?? null) !== (after?.title ?? null);
}

/** How many order documents one write to search carries. */
const ORDER_BATCH = 250;

/**
 * Re-read these orders into the orders collection, a batch at a time. Throws
 * when search refuses any of them, so the event is retried rather than acked
 * over documents that still say the old thing.
 */
async function reindexOrders(ctx: { tenantId: string }, orderIds: string[]): Promise<void> {
  for (let i = 0; i < orderIds.length; i += ORDER_BATCH) {
    const docs = await projectOrders(ctx, orderIds.slice(i, i + ORDER_BATCH));
    const res = await bulkUpsertOrders(docs);
    const first = res.errors[0];
    if (first) {
      throw new Error(
        `search refused ${String(res.errors.length)} of ${String(docs.length)} order documents: ${first.error}`
      );
    }
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

/** The product this catalog event is about. Reads `productId` when the payload
 *  carries one, otherwise resolves it from the `variantId` that every variant
 *  and inventory event does carry. Null (with a warning) when the payload names
 *  neither, or when the variant has since been hard-deleted. */
async function resolveProductId(
  ctx: { tenantId: string },
  event: CommerceEventEnvelope,
  logger: PinoLogger
): Promise<string | undefined> {
  const productId = stringProp(event.data, 'productId');
  if (productId) return productId;

  const variantId = stringProp(event.data, 'variantId');
  if (!variantId) {
    logger.warn({ type: event.type }, 'event names neither a product nor a variant; skipping');
    return undefined;
  }

  const resolved = await productIdForVariant(ctx, variantId);
  if (!resolved) {
    logger.warn({ type: event.type, variantId }, 'variant not found; skipping');
    return undefined;
  }
  return resolved;
}

function stringProp(data: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = data?.[key];
  return typeof v === 'string' ? v : undefined;
}

function stringArrayProp(data: Record<string, unknown> | undefined, key: string): string[] {
  const v = data?.[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}
