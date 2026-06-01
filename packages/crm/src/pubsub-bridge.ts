// CRM → Google Pub/Sub bridge.
//
// The CRM emits two streams of events that until now stayed in-process:
//
//   1. publishCrmEvent(...)  → the CRM bus (events.ts), topics `crm.customer.*`
//   2. publishPlatformEvent(...) → the platform bus (consumers/platform-bus.ts),
//      topics `order.*` — consumed in-process by the stats/activity consumer.
//
// Phase 2 of the Typesense build-out needs the commerce-indexer (a Cloud Run
// Pub/Sub-push worker) to see customer + order changes, so both streams must
// also reach real Google Pub/Sub. This module owns that bridge for BOTH buses:
//
//   • CrmPubSubPublisher  — implements the CRM `Publisher`, wraps the active
//     one (so the WebhookFanoutPublisher chain is preserved), and tees each
//     event to Pub/Sub.
//   • installPlatformBusPubSubTee — wraps the active platform bus so order.*
//     publishes ALSO go to Pub/Sub while the in-process subscriber (the CRM
//     stats/activity consumer, locked decision #1) keeps receiving them.
//
// Both publish to a topic named exactly `event.topic` with a body matching the
// commerce-indexer's `CommerceEventEnvelope` ({type,tenantId,actorId,occurredAt,
// data}), so the indexer decodes them identically to product.* events.
//
// This lives in its OWN module (subpath export `@sparx/crm/pubsub`) — NOT the
// package barrel — so the heavy `@google-cloud/pubsub` gRPC dependency only
// loads in the backend services that install it (api-rest, api-graphql,
// api-mcp). The dashboard transpiles `@sparx/crm` and writes customers via
// api-rest, so it must never pull this in.

import { PubSub, type Topic } from '@google-cloud/pubsub';

import {
  getPublisher,
  setPublisher,
  type CrmEvent,
  type Publisher as CrmPublisher,
} from './events';
import {
  getPlatformBus,
  setPlatformBus,
  type PlatformEvent,
  type PlatformEventBus,
  type PlatformEventHandler,
} from './consumers/platform-bus';

export interface BridgeLogger {
  info(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

// The envelope the commerce-indexer decodes. Topic name == event type.
interface IndexerEnvelope {
  type: string;
  tenantId: string;
  actorId: string | null;
  occurredAt: string;
  data: Record<string, unknown>;
}

// One shared Pub/Sub client + topic cache across both bridges. Topics are
// created in Terraform; the client only publishes.
class TopicPublisher {
  private readonly client: PubSub;
  private readonly cache = new Map<string, Topic>();

  constructor(projectId: string) {
    this.client = new PubSub({ projectId });
  }

  private topicFor(name: string): Topic {
    let topic = this.cache.get(name);
    if (!topic) {
      topic = this.client.topic(name, {
        batching: { maxMessages: 100, maxMilliseconds: 50 },
      });
      this.cache.set(name, topic);
    }
    return topic;
  }

  async publish(envelope: IndexerEnvelope, attributes: Record<string, string>): Promise<void> {
    const data = Buffer.from(JSON.stringify(envelope));
    await this.topicFor(envelope.type).publishMessage({ data, attributes });
  }
}

// ─── CRM bus bridge ──────────────────────────────────────────────────

/** Publisher that tees a CrmEvent to Pub/Sub then delegates to the inner
 *  publisher (preserving the webhook fan-out chain). Publish failures are
 *  logged and swallowed — a Pub/Sub outage must never fail the originating
 *  request, which has already committed (events are published post-commit). */
export class CrmPubSubPublisher implements CrmPublisher {
  constructor(
    private readonly topics: TopicPublisher,
    private readonly logger: BridgeLogger,
    private readonly inner: CrmPublisher
  ) {}

  async publish(event: CrmEvent): Promise<void> {
    const envelope: IndexerEnvelope = {
      type: event.topic,
      tenantId: event.tenantId,
      actorId: null,
      occurredAt: (event.occurredAt ?? new Date()).toISOString(),
      data: event.payload,
    };
    try {
      const attributes: Record<string, string> = { type: event.topic, tenantId: event.tenantId };
      if (event.dedupeKey) attributes.dedupeKey = event.dedupeKey;
      await this.topics.publish(envelope, attributes);
    } catch (err) {
      this.logger.error({ err, topic: event.topic }, 'crm-pubsub: publish failed');
    }
    await this.inner.publish(event);
  }
}

// ─── Platform bus tee ────────────────────────────────────────────────

/** Platform bus wrapper that forwards every publish to the inner bus (so the
 *  in-process CRM consumer still runs) AND tees a subset of topics to Pub/Sub.
 *  Subscriptions delegate straight to the inner bus. */
class PubSubTeePlatformBus implements PlatformEventBus {
  constructor(
    private readonly inner: PlatformEventBus,
    private readonly topics: TopicPublisher,
    private readonly logger: BridgeLogger,
    private readonly teeTopics: ReadonlySet<string>
  ) {}

  async publish(event: PlatformEvent): Promise<void> {
    if (this.teeTopics.has(event.topic)) {
      const envelope: IndexerEnvelope = {
        type: event.topic,
        tenantId: event.tenantId,
        actorId: null,
        occurredAt: event.occurredAt.toISOString(),
        data: (event.payload ?? {}) as Record<string, unknown>,
      };
      try {
        await this.topics.publish(envelope, { type: event.topic, tenantId: event.tenantId });
      } catch (err) {
        this.logger.error({ err, topic: event.topic }, 'platform-pubsub: publish failed');
      }
    }
    await this.inner.publish(event);
  }

  subscribe(topic: string, handler: PlatformEventHandler): () => void {
    return this.inner.subscribe(topic, handler);
  }

  drain(): Promise<void> {
    return this.inner.drain();
  }
}

// Order topics the indexer cares about. Other platform topics (email.*, etc.)
// stay in-process only — teeing them would publish to topics nothing reads.
const ORDER_TEE_TOPICS: ReadonlySet<string> = new Set([
  'order.created',
  'order.cancelled',
  'order.payment.recorded',
  'order.fulfilled',
  'order.delivered',
  'order.refunded',
]);

let installed = false;

export interface InstallOptions {
  projectId?: string;
  logger: BridgeLogger;
}

/**
 * Install the real Pub/Sub bridges for BOTH the CRM bus and the platform bus.
 * No-op when `projectId` is unset (dev parity with the api-core / events
 * stubs — local dev keeps the LoggingPublisher + in-memory bus). Idempotent.
 *
 * MUST run before `installCrmWebhookFanout()` so the fanout wraps the
 * Pub/Sub-backed inner publisher rather than the other way round — otherwise
 * a later `setPublisher(fanout)` would be wrapping the stub and we'd lose the
 * tee. (The fanout reads `getPublisher()` and wraps whatever it finds.)
 */
export function installCrmPubSubBridge({ projectId, logger }: InstallOptions): void {
  if (installed) return;
  if (!projectId) {
    logger.info({}, 'crm-pubsub: projectId unset — bridge disabled (dev stub)');
    return;
  }
  const topics = new TopicPublisher(projectId);

  // CRM bus: wrap the active publisher (LoggingPublisher in a fresh process).
  setPublisher(new CrmPubSubPublisher(topics, logger, getPublisher()));

  // Platform bus: wrap the active bus so order.* tees to Pub/Sub.
  setPlatformBus(new PubSubTeePlatformBus(getPlatformBus(), topics, logger, ORDER_TEE_TOPICS));

  installed = true;
  logger.info({ projectId }, 'crm-pubsub: bridges installed (crm.* + order.*)');
}

/** Test hook — reset the install guard between suites. */
export function _resetBridgeForTest(): void {
  installed = false;
}
