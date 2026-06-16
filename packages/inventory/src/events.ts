// Inventory Pub/Sub event publisher.
//
// Mirrors @sparx/commerce's `publishCommerceEvent` pattern: a thin wrapper over
// @sparx/events so the module emits typed `inventory.*` topics from one place,
// with a consistent logger. The actual transport is @sparx/events, which talks
// to Google Pub/Sub in prod and a noop-with-logging publisher in dev/test.
//
// Always called AFTER a DB transaction commits — never inside one. A rolled-back
// write must never emit a phantom event.

import {
  createPublisher,
  indexEntity,
  publishEvent,
  type EventType,
  type PublisherLogger,
} from '@sparx/events';

const logger: PublisherLogger = {
  info: (obj, msg) => console.log(JSON.stringify({ level: 'info', src: 'inventory', ...obj, msg })),
  warn: (obj, msg) =>
    console.warn(JSON.stringify({ level: 'warn', src: 'inventory', ...obj, msg })),
  error: (obj, msg) =>
    console.error(JSON.stringify({ level: 'error', src: 'inventory', ...obj, msg })),
};

// Subset of EventType the Inventory module publishes. Narrowing here means a
// typo in a topic surfaces at compile time. Adding a new inventory event
// requires (1) extending EventType in @sparx/events and (2) listing it here.
export type InventoryTopic = Extract<
  EventType,
  'inventory.adjusted' | 'inventory.low' | 'inventory.depleted'
>;

export interface InventoryEventInput<T = Record<string, unknown>> {
  tenantId: string;
  actorId?: string | null;
  topic: InventoryTopic;
  data: T;
}

export async function publishInventoryEvent<T>(input: InventoryEventInput<T>): Promise<void> {
  const publisher = createPublisher({
    projectId: process.env.GCP_PROJECT_ID,
    logger,
  });
  await publishEvent(
    publisher,
    input.topic,
    input.tenantId,
    input.actorId ?? null,
    input.data,
    logger
  );
}

/**
 * Post-commit universal-search signal for inventory entities (e.g. warehouse).
 * Call AFTER the write commits; never throws into the caller. `op: 'delete'`
 * removes the doc; `'upsert'` (default) re-projects it.
 */
export async function indexInventoryEntity(
  ctx: { tenantId: string; userId?: string | null },
  entityType: string,
  recordId: string,
  op: 'upsert' | 'delete' = 'upsert'
): Promise<void> {
  await indexEntity({
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    entityType,
    recordId,
    op,
  });
}
