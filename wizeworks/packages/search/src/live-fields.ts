// Which fields a LIVE collection actually has, so a search can ask for a new
// field only once the collection holds it.
//
// WHY. A new field reaches a collection when the indexer boots: `ensureSchemas`
// adds every optional field the live collection is missing. The API does not
// wait for that. A release rolls api-rest and the event-worker side by side with
// no order between them, and `ensureSchemas` can also fail outright (it needs
// the admin key) and only log. Meanwhile Typesense rejects the WHOLE search when
// `query_by` names a field the collection does not have: "Could not find a field
// named `company` in the schema." So a search that named the new field as soon
// as the code shipped would fail every query in the box, about everything, until
// the indexer caught up.
//
// So the search code asks here first and leaves the field out until the
// collection has it. One `retrieve` per collection per minute per process,
// shared by every search in that minute.
//
// Both answers expire. A missing field has to be noticed when the indexer adds
// it, without a restart. A present one could vanish if somebody dropped the
// collection and an older indexer recreated it, which is a rollback; re-reading
// once a minute bounds that to a minute of failed searches rather than forever.

import type { Client } from 'typesense';

import { getClient } from './client';

/** How long one reading of a collection's fields is trusted. */
export const LIVE_FIELDS_TTL_MS = 60_000;

interface Reading {
  fields: ReadonlySet<string>;
  at: number;
}

const readings = new Map<string, Reading>();
const inFlight = new Map<string, Promise<ReadonlySet<string>>>();

async function readFields(collection: string, client: Client): Promise<ReadonlySet<string>> {
  try {
    const live = await client.collections(collection).retrieve();
    return new Set((live.fields ?? []).map((f) => f.name));
  } catch {
    // Could not look: a missing collection, an outage, a key without read
    // rights. Answer "not there", so the search goes out without the new field
    // and succeeds or fails on its own terms. Never a reason to fail a search.
    return new Set();
  }
}

/**
 * Whether the live collection has `field`, from a reading at most
 * `LIVE_FIELDS_TTL_MS` old. Concurrent callers share one request.
 */
export async function collectionHasField(
  collection: string,
  field: string,
  client: Client = getClient(),
  now: number = Date.now()
): Promise<boolean> {
  const cached = readings.get(collection);
  if (cached && now - cached.at < LIVE_FIELDS_TTL_MS) return cached.fields.has(field);

  let pending = inFlight.get(collection);
  if (!pending) {
    pending = readFields(collection, client).finally(() => inFlight.delete(collection));
    inFlight.set(collection, pending);
  }
  const fields = await pending;
  readings.set(collection, { fields, at: now });
  return fields.has(field);
}

/** Forget every reading. For tests, and for a caller that has just changed a schema. */
export function forgetLiveFields(): void {
  readings.clear();
  inFlight.clear();
}
