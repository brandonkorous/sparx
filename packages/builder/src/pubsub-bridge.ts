// Builder → Google Pub/Sub bridge (docs/127 §6).
//
// `publishBuilderEvent` has always emitted `builder.page.published` /
// `builder.layout.published` / `builder.layout.activated` / `builder.email.published`,
// and until now every one of them went to `console.log` and stopped there: the default
// `LoggingPublisher` in events.ts was never replaced outside tests, so nothing
// downstream could react to a publish.
//
// That is the reason the storefront reads are `cache: 'no-store'`. apps/site's builder
// and silica readers both carry an INTERIM comment saying a TTL would just serve stale
// pages because "no tag-purge is wired yet (the deferred Pub/Sub→cache-revalidation-
// worker slice)". This module is that slice. With it installed, publish emits a real
// message, `cache-revalidation-worker` maps it to the `builder` scope, and the
// storefront can go back to cached reads with on-demand purge.
//
// Mirrors packages/crm/src/pubsub-bridge.ts exactly — same envelope, same
// topic-name-equals-event-type rule, same wrap-the-active-publisher composition so an
// already-installed decorator survives. It lives in its OWN module (subpath export
// `@sparx/builder/pubsub`) rather than the package barrel so the heavy
// `@google-cloud/pubsub` gRPC dependency only loads in the backend services that
// install it — apps/dashboard transpiles `@sparx/builder` and must never pull it in.

import { PubSub, type Topic } from '@google-cloud/pubsub';

import { getPublisher, setPublisher, type BuilderEvent, type Publisher } from './events';

export interface BridgeLogger {
  info(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

// The envelope every Pub/Sub consumer in the platform decodes (cf. the
// commerce-indexer + cache-revalidation-worker `CacheEventEnvelope`). Topic name
// == event type, per the platform convention in the root CLAUDE.md.
interface EventEnvelope {
  type: string;
  tenantId: string;
  actorId: string | null;
  occurredAt: string;
  data: Record<string, unknown>;
}

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

  async publish(envelope: EventEnvelope, attributes: Record<string, string>): Promise<void> {
    await this.topicFor(envelope.type).publishMessage({
      data: Buffer.from(JSON.stringify(envelope)),
      attributes,
    });
  }
}

/** Wraps the active builder publisher and tees each event to Pub/Sub. */
class BuilderPubSubPublisher implements Publisher {
  constructor(
    private readonly topics: TopicPublisher,
    private readonly logger: BridgeLogger,
    private readonly inner: Publisher
  ) {}

  async publish(event: BuilderEvent): Promise<void> {
    // Inner first, so the existing logging/recording behaviour is preserved even if
    // the Pub/Sub publish throws.
    await this.inner.publish(event);

    const envelope: EventEnvelope = {
      type: event.topic,
      tenantId: event.tenantId,
      actorId: null,
      occurredAt: (event.occurredAt ?? new Date()).toISOString(),
      data: event.payload,
    };
    try {
      await this.topics.publish(envelope, {
        tenantId: event.tenantId,
        ...(event.dedupeKey ? { dedupeKey: event.dedupeKey } : {}),
      });
    } catch (err) {
      // A failed cache purge must never fail the publish that triggered it — the
      // author's page IS published; the storefront just serves a stale read until the
      // TTL lapses. Loud, not fatal.
      this.logger.error(
        { err, topic: event.topic, tenantId: event.tenantId },
        'builder-pubsub: publish failed; cache purge skipped'
      );
    }
  }
}

let installed = false;

export interface InstallOptions {
  projectId?: string;
  logger: BridgeLogger;
}

/**
 * Install the Pub/Sub bridge for builder events. No-op when `projectId` is unset
 * (dev parity with the api-core / events stubs — local dev keeps the
 * LoggingPublisher). Idempotent.
 */
export function installBuilderPubSubBridge({ projectId, logger }: InstallOptions): void {
  if (installed) return;
  if (!projectId) {
    logger.info({}, 'builder-pubsub: projectId unset — bridge disabled (dev stub)');
    return;
  }
  setPublisher(new BuilderPubSubPublisher(new TopicPublisher(projectId), logger, getPublisher()));
  installed = true;
  logger.info({ projectId }, 'builder-pubsub: bridge installed (builder.*)');
}

/** Test hook — reset the install guard between suites. */
export function _resetBridgeForTest(): void {
  installed = false;
}
