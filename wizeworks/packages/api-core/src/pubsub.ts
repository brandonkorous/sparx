// Event publishing for the API services, plus the internal webhook fan-out that
// rides alongside it.
//
// THIS FILE USED TO CONTAIN A SECOND PUBLISHER. `CloudPubSubPublisher`,
// `LoggingPublisher`, the topic cache, the fan-in tee and the "which transport"
// decision were all duplicated here, byte-for-byte, from
// wizeworks/packages/events/src/publisher.ts — two implementations of one behaviour, each
// with its own env var (`gcpProjectId` here, `GCP_PROJECT_ID` there) selecting
// between a real broker and a stub. Fixing the silent-event-loss bug in one of
// them would have left the other still doing it.
//
// The transport now lives in @wizeworks/events and is chosen by `EVENT_BROKER`, in
// exactly one place. What remains here is the thing that is genuinely
// api-core's: publishing an event AND enqueuing its webhook deliveries as one
// operation.

import type { FastifyBaseLogger } from 'fastify';
import {
  createPublisher,
  type EventType,
  type Publisher,
  type SparxEvent,
} from '@wizeworks/events';
import { withTenant } from '@wizeworks/db';
import { enqueueWebhookDeliveries } from './webhook-delivery.js';

// The canonical event registry lives in @wizeworks/events (docs/82 §3.1 — one source
// of truth; the two unions had drifted). api-core re-exports it so existing
// `@wizeworks/api-core/pubsub` importers are unchanged.
export type { EventType, SparxEvent, Publisher };

/**
 * The process-wide publisher.
 *
 * No `configurePubsub` any more, and nothing to call at boot. That function
 * existed to hand this module a GCP project id, which was both the credential
 * AND the switch deciding whether events went anywhere at all — so a service
 * that forgot the call, or a deployment that dropped the variable, got a
 * silently discarding publisher and no indication of it. `@wizeworks/events` reads
 * `EVENT_BROKER` itself and throws in production when it is missing.
 *
 * Caching lives in `createPublisher`, so repeated calls are free.
 */
export function getPublisher(logger: FastifyBaseLogger): Publisher {
  return createPublisher({ logger });
}

/**
 * Release the publisher's transport, for a caller that is not a server.
 *
 * A no-op on every transport but NATS, which holds an open socket — so a script
 * that publishes and then simply falls off the end of `main()` never exits.
 * Servers must NOT call this: the publisher is process-wide and cached.
 */
export async function closePublisher(logger: FastifyBaseLogger): Promise<void> {
  await getPublisher(logger).close?.();
}

export async function publish<T extends Record<string, unknown>>(
  logger: FastifyBaseLogger,
  type: EventType,
  tenantId: string,
  actorId: string | null,
  data: T
): Promise<void> {
  const event: SparxEvent<T> = {
    type,
    tenantId,
    actorId,
    occurredAt: new Date().toISOString(),
    data,
  };

  // 1. Internal webhook fan-out: enqueue a row per matching subscription
  //    so the webhook-delivery tick (lib/webhook-delivery.ts) picks them
  //    up. Best-effort — failure here doesn't roll back the caller's
  //    mutation, since the originating tx has already committed.
  try {
    await withTenant({ tenantId }, async (tx) => {
      await enqueueWebhookDeliveries(tx, tenantId, type, data);
    });
  } catch (err) {
    logger.error({ err, event }, 'events: webhook enqueue failed');
  }

  // 2. Broker fan-out: one topic/subject per EventType.
  try {
    await getPublisher(logger).publish(event);
  } catch (err) {
    // Never fail a mutation because the broker is down — the originating
    // transaction has already committed, so throwing here would report a
    // failure for work that actually succeeded. On a durable transport
    // (nats/pubsub) this is a genuine delivery failure worth alerting on,
    // which is why it is logged at error rather than swallowed.
    logger.error({ err, event }, 'events: publish failed');
  }
}
