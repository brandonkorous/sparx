// Admin operations — collection lifecycle, used by the indexer worker at
// boot and by staff "Rebuild search index" actions in the dashboard.

import type { Client } from 'typesense';

import { getClient } from './client';
import {
  allSchemas,
  CUSTOMERS_COLLECTION,
  ENTITIES_COLLECTION,
  ORDERS_COLLECTION,
  PRODUCTS_COLLECTION,
} from './schemas';

export async function ensureSchemas(client: Client = getClient()): Promise<{
  created: string[];
  existing: string[];
  altered: string[];
}> {
  const created: string[] = [];
  const existing: string[] = [];
  const altered: string[] = [];
  for (const { name, schema } of allSchemas()) {
    try {
      const live = await client.collections(name).retrieve();
      existing.push(name);

      // Self-heal additive schema bumps: add any OPTIONAL schema field the live
      // collection is missing (e.g. a new facet like `property_ids`). Typesense
      // only permits adding optional fields to a populated collection — which is
      // precisely what an additive bump is — so a deploy that introduces a field
      // reconciles itself on the next indexer boot, no manual reindex/recreate.
      // We never modify or drop existing fields (matched by name), so this is
      // safe to run every boot.
      const liveNames = new Set(live.fields?.map((f) => f.name));
      const missing = (schema.fields ?? []).filter(
        (f) => f.optional === true && !liveNames.has(f.name)
      );
      if (missing.length > 0) {
        await client.collections(name).update({ fields: missing });
        altered.push(name);
      }
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
  return { created, existing, altered };
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
  [ENTITIES_COLLECTION]: 'title',
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
  const names = [PRODUCTS_COLLECTION, CUSTOMERS_COLLECTION, ORDERS_COLLECTION, ENTITIES_COLLECTION];
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
