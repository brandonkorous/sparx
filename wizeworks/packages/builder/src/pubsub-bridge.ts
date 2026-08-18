// Builder → event-broker bridge (docs/127 §6; transport-agnostic, see @wizeworks/events).
//
// `publishBuilderEvent` has always emitted `builder.page.published` /
// `builder.layout.published` / `builder.layout.activated` / `builder.email.published`,
// and until now every one of them went to `console.log` and stopped there: the default
// `LoggingPublisher` in events.ts was never replaced outside tests, so nothing
// downstream could react to a publish.
//
// That is the reason the storefront reads are `cache: 'no-store'`. wizeworks/apps/site's builder
// and silica readers both carry an INTERIM comment saying a TTL would just serve stale
// pages because "no tag-purge is wired yet (the deferred Pub/Sub→cache-revalidation-
// worker slice)". This module is that slice. With it installed, publish emits a real
// message, `cache-revalidation-worker` maps it to the `builder` scope, and the
// storefront can go back to cached reads with on-demand purge.
//
// Mirrors wizeworks/packages/crm/src/pubsub-bridge.ts exactly — same envelope, same
// topic-name-equals-event-type rule, same wrap-the-active-publisher composition so an
// already-installed decorator survives. It lives in its OWN module (subpath export
// `@wizeworks/builder/pubsub`) rather than the package barrel so the heavy
// `@google-cloud/pubsub` gRPC dependency only loads in the backend services that
// install it — apps/dashboard transpiles `@wizeworks/builder` and must never pull it in.

import {
  createPublisher,
  publishRaw,
  resolveTransport,
  type Publisher as EventPublisher,
} from '@wizeworks/events';

import { getPublisher, setPublisher, type BuilderEvent, type Publisher } from './events';

export interface BridgeLogger {
  info(obj: object, msg?: string): void;
  // `warn` is required by @wizeworks/events' PublisherLogger, which this bridge now
  // hands its logger to. Every caller already satisfies it (console, pino) — it
  // was simply never declared, because the old bridge logged through its own
  // Pub/Sub client and never crossed the package boundary.
  warn(obj: object, msg?: string): void;
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

// Publishes through the SHARED transport in @wizeworks/events.
//
// This owned `new PubSub({ projectId })` — the FOURTH copy of the publisher in
// the repo (wizeworks/packages/events, wizeworks/packages/api-core, wizeworks/packages/crm being the others).
// And like the CRM bridge, `installBuilderPubSubBridge` returned early when the
// project id was falsy, so on a non-GCP deployment no `builder.*` event was
// published at all. cache-revalidation-worker therefore had nothing to map to
// the `builder` scope and never purged anything — which is why wizeworks/apps/site still
// reads builder + silica with `cache: 'no-store'` (docs/127 §6). That workaround
// exists because of this bug.
class TopicPublisher {
  constructor(private readonly inner: EventPublisher) {}

  async publish(envelope: EventEnvelope, _attributes: Record<string, string>): Promise<void> {
    // Attributes dropped: they duplicated `type`/`tenantId`, both of which the
    // consumer already reads out of the envelope body.
    await publishRaw(this.inner, envelope);
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
  /** DEPRECATED and ignored. The transport is resolved from EVENT_BROKER. */
  projectId?: string;
  logger: BridgeLogger;
}

/**
 * Install the broker bridge for builder events. Idempotent.
 *
 * ALWAYS INSTALLS. The old `if (!projectId) return` read as dev parity with the
 * stubs, but it meant the bridge was permanently disabled on any non-GCP
 * deployment — builder.* events went to the in-process publisher and stopped,
 * with no cache purge ever reaching the storefront. There is nothing to gate on
 * now: the transport in @wizeworks/events decides what a publish does, once, for
 * every publisher in the platform.
 */
export function installBuilderPubSubBridge({ logger }: InstallOptions): void {
  if (installed) return;
  setPublisher(
    new BuilderPubSubPublisher(
      new TopicPublisher(createPublisher({ logger })),
      logger,
      getPublisher()
    )
  );
  installed = true;
  logger.info(
    { transport: resolveTransport().kind },
    'builder-pubsub: bridge installed (builder.*)'
  );
}

/** Test hook — reset the install guard between suites. */
export function _resetBridgeForTest(): void {
  installed = false;
}
