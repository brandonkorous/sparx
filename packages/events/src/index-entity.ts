// indexEntity — the one-line post-commit helper every module calls to keep
// the universal `entities` search collection live (docs/39 §6.1).
//
// Publishes a single `search.entity.changed` event; the commerce-indexer looks
// the `entityType` up in its projector registry, re-projects the record, and
// upserts/deletes it. One generic event for every entity type — no per-entity
// topic. Like the other publishers it NEVER throws into the caller (publishEvent
// swallows transport errors); always call it AFTER the DB transaction commits.

import { createPublisher, publishEvent, type PublisherLogger } from './publisher';
import type { SearchEntityChangedPayload } from './types';

const logger: PublisherLogger = {
  info: (obj, msg) =>
    console.log(JSON.stringify({ level: 'info', src: 'search-index', ...obj, msg })),
  warn: (obj, msg) =>
    console.warn(JSON.stringify({ level: 'warn', src: 'search-index', ...obj, msg })),
  error: (obj, msg) =>
    console.error(JSON.stringify({ level: 'error', src: 'search-index', ...obj, msg })),
};

export interface IndexEntityInput {
  tenantId: string;
  actorId?: string | null;
  /** Projector registry key — e.g. 'warehouse', 'b2b_account'. */
  entityType: string;
  /** The owning module's stable record id. */
  recordId: string;
  /** 'upsert' (default) reprojects; 'delete' removes from the index. */
  op?: SearchEntityChangedPayload['op'];
}

// Returns Promise<void> (so existing `await indexEntity(...)` call sites stay
// valid + lint-clean) but the publish is DETACHED, not awaited: a search reindex
// must never block — or fail — the request that triggered it. Awaiting the
// publish couples request latency to Pub/Sub availability, so a slow/unreachable
// broker (e.g. local dev without the emulator) stalls the caller's response for
// the client's full retry window (and can back the whole service up). publishEvent
// already swallows transport errors; we detach so the handler returns immediately
// and the event still flushes on the event loop. This is the event-driven
// convention: publish-and-forget the side effect, never inline-await it.
export function indexEntity(input: IndexEntityInput): Promise<void> {
  const publisher = createPublisher({ logger });
  const payload: SearchEntityChangedPayload = {
    entityType: input.entityType,
    recordId: input.recordId,
    op: input.op ?? 'upsert',
  };
  void publishEvent(
    publisher,
    'search.entity.changed',
    input.tenantId,
    input.actorId ?? null,
    payload,
    logger
  ).catch((err: unknown) => {
    logger.error(
      { err: err instanceof Error ? err.message : String(err), entityType: input.entityType },
      'search index publish failed'
    );
  });
  return Promise.resolve();
}
