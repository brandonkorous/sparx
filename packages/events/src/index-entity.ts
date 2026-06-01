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

export async function indexEntity(input: IndexEntityInput): Promise<void> {
  const publisher = createPublisher({ projectId: process.env.GCP_PROJECT_ID, logger });
  const payload: SearchEntityChangedPayload = {
    entityType: input.entityType,
    recordId: input.recordId,
    op: input.op ?? 'upsert',
  };
  await publishEvent(
    publisher,
    'search.entity.changed',
    input.tenantId,
    input.actorId ?? null,
    payload,
    logger
  );
}
