// commerce-indexer — keeps the Typesense search index in step with commerce.
//
// A library, registered by services/event-worker. See legal-seed-worker/src for
// the note on why these are no longer separate containers; `DURABLE` is the
// JetStream cursor key and must not change.

import type { Logger } from 'pino';
import { createBrokerHandler, type WorkerSubscription } from '@sparx/events';
import { ensureSchemas, ensureSynonyms } from '@sparx/search';

import { env } from './env.js';
import { handleEvent, type CommerceEventEnvelope } from './handler.js';

export const DURABLE = 'commerce-indexer';
export const EVENTS = [
  'product.created',
  'product.updated',
  'product.deleted',
  'variant.created',
  'variant.updated',
  'variant.deleted',
  'inventory.adjusted',
  'order.cancelled',
  'order.fulfilled',
  'order.delivered',
  'order.refunded',
  'search.reindex.requested',
  'search.entity.changed',
];

/**
 * Structural check only — the envelope is routed by `type`, and `handleEvent`
 * validates the payload it actually needs. Anything without a string `type` can
 * never be routed, so it is off-schema and gets acked.
 */
function parseEvent(raw: unknown): CommerceEventEnvelope | null {
  const e = raw as Partial<CommerceEventEnvelope> | undefined;
  if (!e || typeof e.type !== 'string') return null;
  return e as CommerceEventEnvelope;
}

/**
 * Create the Typesense collections and synonyms this handler writes into.
 *
 * Boot work, not per-message work, so `services/event-worker` calls it once
 * before starting subscriptions. It never throws: schema creation needs an
 * admin API key that a search-only key will not have, and a process that
 * refuses to start over that would take the other eleven handlers down with it.
 * Upserts still work when the collections already exist.
 */
export async function boot(logger: Logger): Promise<void> {
  if (!env.ENSURE_SCHEMAS_ON_BOOT) return;
  try {
    logger.info(await ensureSchemas(), 'typesense schemas ensured');
    // Synonyms ride on the same admin-key step (the collection must exist
    // first). Separate try so a synonym hiccup does not undo a successful
    // schema ensure — search still works without synonyms.
    try {
      logger.info(await ensureSynonyms(), 'typesense synonyms ensured');
    } catch (err) {
      logger.error({ err }, 'failed to ensure typesense synonyms; continuing');
    }
  } catch (err) {
    logger.error({ err }, 'failed to ensure typesense schemas; continuing');
  }
}

export function createSubscription(logger: Logger): WorkerSubscription {
  return {
    durable: DURABLE,
    events: EVENTS,
    // Throwing naks for redelivery. `handleEvent` already treats a Typesense
    // outage as retryable, which is exactly what a broker is for.
    handle: createBrokerHandler({ name: DURABLE, logger, parseEvent, handle: handleEvent }),
  };
}
