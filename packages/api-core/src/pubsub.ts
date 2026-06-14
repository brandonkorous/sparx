// Typed event publisher.
//
// One Pub/Sub topic per `EventType`. Topic name == event type
// (`order.created`, `media.uploaded`, ...) so subscribers only receive the
// events they care about — no fan-out filtering inside worker code, no
// wasted message deliveries, and per-topic IAM + DLQs are possible.
//
// In dev (`gcpProjectId` not configured) the publisher logs the event to
// the Fastify logger and otherwise no-ops — useful for quick iteration
// without standing up a Pub/Sub emulator.
//
// Service-agnostic: each consuming API service calls `configurePubsub`
// once at boot with its env config; route handlers then call `publish` as
// before.

import type { Topic } from '@google-cloud/pubsub';
import { PubSub } from '@google-cloud/pubsub';
import type { FastifyBaseLogger } from 'fastify';
import {
  AUTOMATION_FANIN_TOPIC,
  teeToFanIn,
  localDispatchFromEnv,
  type EventType,
} from '@sparx/events';
import { withTenant } from '@sparx/db';
import { enqueueWebhookDeliveries } from './webhook-delivery.js';

// The canonical event registry lives in @sparx/events (docs/82 §3.1 — one source
// of truth; the two unions had drifted). api-core re-exports it so existing
// `@sparx/api-core/pubsub` importers are unchanged. Type-only ⇒ no runtime dep,
// and every service that COPYs api-core already COPYs @sparx/events.
export type { EventType };

export interface SparxEvent<T = unknown> {
  type: EventType;
  tenantId: string;
  actorId: string | null;
  occurredAt: string; // ISO timestamp
  data: T;
}

interface Publisher {
  publish<T>(event: SparxEvent<T>): Promise<void>;
}

class CloudPubSubPublisher implements Publisher {
  private readonly client: PubSub;
  private readonly topicCache = new Map<string, Topic>();

  constructor(client: PubSub) {
    this.client = client;
  }

  private topicFor(type: string): Topic {
    let topic = this.topicCache.get(type);
    if (!topic) {
      topic = this.client.topic(type, {
        batching: { maxMessages: 100, maxMilliseconds: 50 },
      });
      this.topicCache.set(type, topic);
    }
    return topic;
  }

  async publish<T>(event: SparxEvent<T>): Promise<void> {
    const data = Buffer.from(JSON.stringify(event));
    await this.topicFor(event.type).publishMessage({
      data,
      // `type` attribute kept for parity with logs/dead-letter inspection
      // even though each subscriber only sees its own topic.
      attributes: { type: event.type, tenantId: event.tenantId },
    });
    // Tee to the automation fan-in (docs/82 §3.3) after the per-type publish.
    // Best-effort — a fan-in failure must not surface as a publish failure.
    try {
      await teeToFanIn(this.topicFor(AUTOMATION_FANIN_TOPIC), event);
    } catch {
      // swallow — fan-in is additive; one missed automation trigger is recoverable
    }
  }
}

class LoggingPublisher implements Publisher {
  constructor(private readonly logger: FastifyBaseLogger) {}
  publish<T>(event: SparxEvent<T>): Promise<void> {
    this.logger.info({ event }, '[pubsub:stub] would publish');
    return Promise.resolve();
  }
}

export interface PubsubConfig {
  // When set we use Google Cloud Pub/Sub; otherwise we fall back to a
  // stdout-logging stub. Each service reads this from its own env.ts.
  gcpProjectId?: string;
}

let config: PubsubConfig = {};
let publisher: Publisher | null = null;

export function configurePubsub(next: PubsubConfig): void {
  config = next;
  publisher = null;
}

export function getPublisher(logger: FastifyBaseLogger): Publisher {
  if (publisher) return publisher;

  if (config.gcpProjectId) {
    const client = new PubSub({ projectId: config.gcpProjectId });
    publisher = new CloudPubSubPublisher(client);
    logger.info(
      { project: config.gcpProjectId },
      'pubsub: Google Cloud publisher initialised (per-topic, one topic per EventType)'
    );
  } else {
    // Dev: forward to local workers if SPARX_DEV_WORKER_ROUTES is set, else
    // stdout-log. localDispatchFromEnv returns a Publisher with the same
    // structural shape as this module's local interface.
    publisher = localDispatchFromEnv(logger) ?? new LoggingPublisher(logger);
    if (publisher instanceof LoggingPublisher) {
      logger.info('pubsub: gcpProjectId unset — using stdout-logging stub');
    }
  }
  return publisher;
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
    logger.error({ err, event }, 'pubsub: webhook enqueue failed');
  }

  // 2. External Pub/Sub fan-out: one topic per EventType.
  try {
    await getPublisher(logger).publish(event);
  } catch (err) {
    // Never fail a mutation because Pub/Sub is down — log and continue.
    logger.error({ err, event }, 'pubsub: publish failed');
  }
}
