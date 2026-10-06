// Admin operations — collection lifecycle, used by the indexer worker at
// boot and by staff "Rebuild search index" actions in the dashboard.

import type { Client } from 'typesense';

import { getClient } from './client';
import {
  allSchemas,
  assertTestCollection,
  COLLECTION_PREFIX,
  CUSTOMERS_COLLECTION,
  ENTITIES_COLLECTION,
  GLOBAL_SITE_SCOPE,
  isTestCollection,
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

/**
 * Drop named collections, for TESTS ONLY. Every name must carry a test prefix
 * (`test_<run>_`, see ./schemas/naming.ts); one that does not is refused, loudly,
 * before ANY collection is dropped. Nothing in production drops collections, so
 * nothing outside a test suite can need a name this refuses.
 */
export async function dropTestCollections(
  names: readonly string[],
  client: Client = getClient()
): Promise<string[]> {
  for (const name of names) assertTestCollection(name, 'drop');
  const dropped: string[] = [];
  for (const name of names) {
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

/**
 * Drop the collections `ensureSchemas` creates, for TESTS ONLY. It refuses
 * unless every name carries a test prefix, so it can only ever drop the
 * collections a suite made for itself under `TYPESENSE_COLLECTION_PREFIX`.
 *
 * It used to drop the bare names on whatever instance it reached. On 2026-10-04
 * a test run did exactly that to a developer's local Typesense, and every
 * tenant's search read empty until it was rebuilt by hand.
 */
export async function dropAllSchemas(client: Client = getClient()): Promise<string[]> {
  return dropTestCollections(
    allSchemas().map(({ name }) => name),
    client
  );
}

/**
 * Drop test collections an earlier run left behind (one that crashed before its
 * teardown), for TESTS ONLY. Only names carrying a test prefix are even
 * considered, only ones created before `olderThan`, and never this run's own.
 */
export async function dropStaleTestCollections(
  olderThan: Date,
  client: Client = getClient()
): Promise<string[]> {
  const cutoff = Math.floor(olderThan.getTime() / 1000);
  const live = (await client.collections().retrieve()) as {
    name: string;
    created_at?: number;
  }[];
  const stale = live
    .filter((c) => isTestCollection(c.name))
    .filter((c) => COLLECTION_PREFIX === '' || !c.name.startsWith(COLLECTION_PREFIX))
    .filter((c) => (c.created_at ?? 0) < cutoff)
    .map((c) => c.name);
  return dropTestCollections(stale, client);
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

/**
 * How many of a tenant's CUSTOMERS or ORDERS the ⌘K palette can actually reach.
 *
 * The palette (`GET /v1/search`) is the only home of those two collections, and
 * it filters on the tenant alone — no site scope — so this counts the same way.
 * Products need `findableProductCount` instead, because their count has to be
 * narrowed to one site and to what is on sale.
 *
 * Why a second count exists at all, when `collectionStats` already reports a
 * number per collection: a doc count cannot see what is MISSING. Five documents
 * look exactly like thirty-six until something holds the records and the index
 * side by side. MEASURED on 2026-09-18, Juniper Row: 36 customers and 16 orders
 * in the database, 0 and 0 in the index, and the search box answered "nothing
 * in your records matches that" about every one of them.
 *
 * `collectionStats` reports a missing collection as zero, which is the one
 * reading that must never drive a warning. This returns null for it instead:
 * "we could not look", never "you have nothing".
 *
 * `settledBefore` narrows the count to records that CAME INTO BEING by then: a
 * customer's `created_at`, an order's `placed_at`. The caller counts the database
 * side over the same moment (see `indexedSecondBoundary`), so both halves count
 * the same people. They used to differ: the database side dropped anything
 * EDITED in the last few minutes and this side counted every document, so each
 * customer somebody had just edited hid one who was genuinely missing. A buyer
 * who signed up and was never indexed read as "nothing missing", and the box
 * offered no way to put him back (sparx persona issue 086). An edit never moves
 * either field, so editing somebody can no longer cover for anybody else.
 */
export async function findableRecordCount(
  collection: 'customers' | 'orders',
  tenantId: string,
  settledBefore: Date | null = null,
  client: Client = getClient()
): Promise<number | null> {
  const name = collection === 'customers' ? CUSTOMERS_COLLECTION : ORDERS_COLLECTION;
  const bornField = collection === 'customers' ? 'created_at' : 'placed_at';
  const settled =
    settledBefore === null
      ? ''
      : ` && ${bornField}:<=${String(Math.floor(settledBefore.getTime() / 1000))}`;
  try {
    const res = (await client
      .collections(name)
      .documents()
      .search({
        q: '*',
        query_by: STAT_QUERY_BY[name] ?? 'id',
        filter_by: `tenant_id:=${tenantId}${settled}`,
        per_page: 0,
      })) as { found?: number };
    return res.found ?? 0;
  } catch (err: unknown) {
    if ((err as { httpStatus?: number }).httpStatus === 404) return null;
    throw err;
  }
}

/**
 * The first instant a `findableRecordCount(…, settledBefore)` does NOT cover.
 *
 * The index holds whole seconds (`Math.floor(ms / 1000)`), so a document is
 * counted when its second is at or before `settledBefore`'s. The database side
 * has to stop at the same place: `createdAt < indexedSecondBoundary(settled)`
 * counts exactly the rows whose second the index side counts. Stopping at
 * `settledBefore` itself would leave up to a second of rows on one side only.
 */
export function indexedSecondBoundary(settledBefore: Date): Date {
  return new Date((Math.floor(settledBefore.getTime() / 1000) + 1) * 1000);
}

/**
 * How many of a tenant's products are actually FINDABLE — on sale and present in
 * the index.
 *
 * Separate from `collectionStats` because the two answer different questions and
 * only this one can be compared with the catalog. `collectionStats` counts every
 * product document a tenant has, archived and draft included; the catalog count a
 * caller holds is of products ON SALE. Subtracting one from the other would
 * report a gap that is really just a difference of definition.
 *
 * Why anyone needs it: indexing rides on events, so a product that existed before
 * a subscription was fixed — or that was written while the indexer was down —
 * stays out of the index indefinitely and is silently unfindable. Its owner types
 * its name and is told she has nothing matching. A total that is merely non-zero
 * cannot detect that; only a comparison can (issue 318).
 *
 * Returns null when the collection does not exist yet, which is "we could not
 * look" and must not be rendered as a gap of everything.
 */
export async function findableProductCount(
  tenantId: string,
  propertyId: string | null = null,
  client: Client = getClient()
): Promise<number | null> {
  // The SAME filter the storefront and `/v1/search/products` use: global
  // products plus the ones scoped to this site. Without it this counted every
  // site's catalog while the screen rendering it listed one site's, so an owner
  // with seven sites read "Searching your shop won't find 31 of your products"
  // over a list of 10.
  const site =
    propertyId === null ? '' : ` && property_ids:=[\`${GLOBAL_SITE_SCOPE}\`,\`${propertyId}\`]`;
  try {
    const res = (await client
      .collections(PRODUCTS_COLLECTION)
      .documents()
      .search({
        q: '*',
        query_by: STAT_QUERY_BY[PRODUCTS_COLLECTION] ?? 'id',
        filter_by: `tenant_id:=${tenantId} && status:=active${site}`,
        per_page: 0,
      })) as { found?: number };
    return res.found ?? 0;
  } catch (err: unknown) {
    if ((err as { httpStatus?: number }).httpStatus === 404) return null;
    throw err;
  }
}
