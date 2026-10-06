// Indexer — upserts and deletes one document at a time. The
// commerce-indexer Cloud Run worker consumes product.*, variant.*,
// inventory.adjusted, customer.*, and order.* events and routes them
// through these functions. Batching for full reindex passes is in
// ./bulk.ts.

import type { Client } from 'typesense';

import {
  CUSTOMERS_COLLECTION,
  type CustomerSearchDocument,
  ENTITIES_COLLECTION,
  type UniversalSearchDocument,
  ORDERS_COLLECTION,
  type OrderSearchDocument,
  PRODUCTS_COLLECTION,
  type ProductSearchDocument,
} from './schemas';

import { getClient } from './client';

function client(): Client {
  return getClient();
}

// ─── Universal `entities` collection (docs/39) ───────────────────────
// The universal doc id is `${tenantId}:${entityType}:${recordId}`; callers
// pass the parts so a delete needs no prior read.

export async function upsertEntity(doc: UniversalSearchDocument): Promise<void> {
  await client().collections(ENTITIES_COLLECTION).documents().upsert(doc);
}

/** The entry search holds for one record right now, or null when it has none.
 *  The indexer reads it before overwriting, to see what the write changes. */
export async function getEntity(
  tenantId: string,
  entityType: string,
  recordId: string
): Promise<UniversalSearchDocument | null> {
  return retrieveOrNull<UniversalSearchDocument>(
    ENTITIES_COLLECTION,
    `${tenantId}:${entityType}:${recordId}`
  );
}

async function retrieveOrNull<T>(collection: string, id: string): Promise<T | null> {
  try {
    return (await client().collections(collection).documents(id).retrieve()) as T;
  } catch (err) {
    if ((err as { httpStatus?: number }).httpStatus === 404) return null;
    throw err;
  }
}

/**
 * Take one record out of search. A record that is not there is already out,
 * so that is success, not an error. The indexer deletes on purpose without
 * looking first: an event about a billing document clears whichever of its
 * two kinds (quote or invoice) the row is NOT, and that entry usually never
 * existed. Throwing there would fail and retry every such event forever
 * (sparx persona issue 086).
 */
export async function deleteEntity(
  tenantId: string,
  entityType: string,
  recordId: string
): Promise<void> {
  try {
    await client()
      .collections(ENTITIES_COLLECTION)
      .documents(`${tenantId}:${entityType}:${recordId}`)
      .delete();
  } catch (err) {
    if ((err as { httpStatus?: number }).httpStatus !== 404) throw err;
  }
}

// ─── Products ────────────────────────────────────────────────────────

export async function upsertProduct(doc: ProductSearchDocument): Promise<void> {
  await client().collections(PRODUCTS_COLLECTION).documents().upsert(doc);
}

export async function deleteProduct(tenantId: string, productId: string): Promise<void> {
  await client().collections(PRODUCTS_COLLECTION).documents(`${tenantId}:${productId}`).delete();
}

// ─── Customers ───────────────────────────────────────────────────────

export async function upsertCustomer(doc: CustomerSearchDocument): Promise<void> {
  await client().collections(CUSTOMERS_COLLECTION).documents().upsert(doc);
}

/** The document search holds for one customer right now, or null when it has none. */
export async function getCustomerDocument(
  tenantId: string,
  customerId: string
): Promise<CustomerSearchDocument | null> {
  return retrieveOrNull<CustomerSearchDocument>(CUSTOMERS_COLLECTION, `${tenantId}:${customerId}`);
}

/**
 * Take one customer out of search. Absent is already out, so that is success —
 * the same rule as `deleteEntity`. A trade account's rename or removal re-reads
 * every person ever on its contact list, including people deleted long ago whose
 * document went with them; a delete that threw on "not found" would fail that
 * event and retry it forever.
 */
export async function deleteCustomer(tenantId: string, customerId: string): Promise<void> {
  try {
    await client()
      .collections(CUSTOMERS_COLLECTION)
      .documents(`${tenantId}:${customerId}`)
      .delete();
  } catch (err) {
    if ((err as { httpStatus?: number }).httpStatus !== 404) throw err;
  }
}

// ─── Orders ──────────────────────────────────────────────────────────

export async function upsertOrder(doc: OrderSearchDocument): Promise<void> {
  await client().collections(ORDERS_COLLECTION).documents().upsert(doc);
}

export async function deleteOrder(tenantId: string, orderId: string): Promise<void> {
  await client().collections(ORDERS_COLLECTION).documents(`${tenantId}:${orderId}`).delete();
}
