// Bulk operations — full reindex passes (initial deploy, schema bump,
// recovery from a failed indexer run). Batches in chunks of 250 per the
// Typesense recommendation.

import type { Client } from 'typesense';

import {
  assertTestCollection,
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

const DEFAULT_BATCH = 250;

interface ImportDocumentsResult {
  successCount: number;
  errors: { index: number; document: unknown; error: string }[];
}

async function importBatched(
  collection: string,
  docs: object[],
  batchSize: number
): Promise<ImportDocumentsResult> {
  const client: Client = getClient();
  const result: ImportDocumentsResult = { successCount: 0, errors: [] };
  for (let i = 0; i < docs.length; i += batchSize) {
    const chunk = docs.slice(i, i + batchSize);
    const responses = (await client
      .collections(collection)
      .documents()
      .import(chunk, { action: 'upsert' })) as unknown as {
      success: boolean;
      error?: string;
      document?: unknown;
    }[];
    for (const [idx, r] of responses.entries()) {
      if (r.success) {
        result.successCount += 1;
      } else {
        result.errors.push({
          index: i + idx,
          document: r.document ?? chunk[idx]!,
          error: r.error ?? 'unknown',
        });
      }
    }
  }
  return result;
}

export function bulkUpsertProducts(
  docs: ProductSearchDocument[],
  batchSize = DEFAULT_BATCH
): Promise<ImportDocumentsResult> {
  return importBatched(PRODUCTS_COLLECTION, docs, batchSize);
}

export function bulkUpsertCustomers(
  docs: CustomerSearchDocument[],
  batchSize = DEFAULT_BATCH
): Promise<ImportDocumentsResult> {
  return importBatched(CUSTOMERS_COLLECTION, docs, batchSize);
}

export function bulkUpsertOrders(
  docs: OrderSearchDocument[],
  batchSize = DEFAULT_BATCH
): Promise<ImportDocumentsResult> {
  return importBatched(ORDERS_COLLECTION, docs, batchSize);
}

export function bulkUpsertEntities(
  docs: UniversalSearchDocument[],
  batchSize = DEFAULT_BATCH
): Promise<ImportDocumentsResult> {
  return importBatched(ENTITIES_COLLECTION, docs, batchSize);
}

/** Delete every document for a tenant from a collection. Used when a
 *  tenant offboards (GDPR / contract end), and by a full reindex.
 *
 *  Under a test runner (vitest sets `VITEST`) it refuses any collection without
 *  a test prefix, so a test that reaches it unmocked cannot empty a real
 *  tenant's documents on the developer's Typesense. See ./schemas/naming.ts. */
export async function dropTenantFromCollection(
  collection: string,
  tenantId: string
): Promise<{ deleted: number }> {
  if (process.env.VITEST) assertTestCollection(collection, 'delete documents from');
  const client = getClient();
  const res = await client
    .collections(collection)
    .documents()
    .delete({ filter_by: `tenant_id:=${tenantId}` });
  return { deleted: res.num_deleted ?? 0 };
}
