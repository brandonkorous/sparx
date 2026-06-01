// Admin operations — collection lifecycle, used by the indexer worker at
// boot and by staff "Rebuild search index" actions in the dashboard.

import type { Client } from 'typesense';

import { getClient } from './client';
import {
  allSchemas,
  CUSTOMERS_COLLECTION,
  ORDERS_COLLECTION,
  PRODUCTS_COLLECTION,
} from './schemas';

export async function ensureSchemas(client: Client = getClient()): Promise<{
  created: string[];
  existing: string[];
}> {
  const created: string[] = [];
  const existing: string[] = [];
  for (const { name, schema } of allSchemas()) {
    try {
      await client.collections(name).retrieve();
      existing.push(name);
    } catch (err: unknown) {
      const status = (err as { httpStatus?: number }).httpStatus;
      if (status === 404) {
        await client.collections().create(schema);
        created.push(name);
      } else {
        throw err;
      }
    }
  }
  return { created, existing };
}

export async function dropAllSchemas(client: Client = getClient()): Promise<string[]> {
  const dropped: string[] = [];
  for (const { name } of allSchemas()) {
    try {
      await client.collections(name).delete();
      dropped.push(name);
    } catch (err: unknown) {
      const status = (err as { httpStatus?: number }).httpStatus;
      if (status !== 404) throw err;
    }
  }
  return dropped;
}

export async function aliasCollection(input: {
  alias: string;
  target: string;
  client?: Client;
}): Promise<void> {
  const c = input.client ?? getClient();
  await c.aliases().upsert(input.alias, { collection_name: input.target });
}

export interface CollectionStat {
  collection: string;
  /** Number of documents in this collection scoped to the tenant. */
  documents: number;
}

// query_by is required by the client even for a match-all (`q:'*'`) search;
// pick a field that exists in each collection. Ranking is irrelevant here —
// we only read `found` from a zero-result page.
const STAT_QUERY_BY: Record<string, string> = {
  [PRODUCTS_COLLECTION]: 'title',
  [CUSTOMERS_COLLECTION]: 'full_name',
  [ORDERS_COLLECTION]: 'order_number',
};

/**
 * Per-collection document counts for one tenant. Used by the search status
 * endpoint. Uses a filtered match-all with `per_page:0` and reads `found`,
 * because `collection.retrieve().num_documents` is collection-wide (all
 * tenants) — not what a tenant-scoped status view wants. A missing
 * collection (404) reports zero rather than throwing.
 */
export async function collectionStats(
  tenantId: string,
  client: Client = getClient()
): Promise<CollectionStat[]> {
  const names = [PRODUCTS_COLLECTION, CUSTOMERS_COLLECTION, ORDERS_COLLECTION];
  const out: CollectionStat[] = [];
  for (const name of names) {
    try {
      const res = (await client
        .collections(name)
        .documents()
        .search({
          q: '*',
          query_by: STAT_QUERY_BY[name] ?? 'id',
          filter_by: `tenant_id:=${tenantId}`,
          per_page: 0,
        })) as { found?: number };
      out.push({ collection: name, documents: res.found ?? 0 });
    } catch (err: unknown) {
      const status = (err as { httpStatus?: number }).httpStatus;
      if (status === 404) {
        out.push({ collection: name, documents: 0 });
      } else {
        throw err;
      }
    }
  }
  return out;
}
