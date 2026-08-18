// CRM → event-broker bridge (transport-agnostic; see @wizeworks/events).
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
// This lives in its OWN module (subpath export `@wizeworks/crm/pubsub`) — NOT the
// package barrel — so the heavy `@google-cloud/pubsub` gRPC dependency only
// loads in the backend services that install it (api-rest, api-graphql,
// api-mcp). The dashboard transpiles `@wizeworks/crm` and writes customers via
// api-rest, so it must never pull this in.

import { createPublisher, publishRaw, resolveTransport, type Publisher } from '@wizeworks/events';

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
  // `warn` is required by @wizeworks/events' PublisherLogger, which this bridge now
  // hands its logger to. Every caller already satisfies it (console, pino) — it
  // was simply never declared, because the old bridge logged through its own
  // Pub/Sub client and never crossed the package boundary.
  warn(obj: object, msg?: string): void;
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

// Map a CRM domain topic (`crm.<entity>.<action>`) → the universal-search
// entity it should reindex, reading the record id from the payload's
// `<entity>Id` field. Topics whose entity has no universal projector
// (customer → rich collection, activity) map to nothing. (docs/39 §6.1)
const CRM_UNIVERSAL_BY_ENTITY: Record<string, { entityType: string; idField: string }> = {
  b2b_account: { entityType: 'b2b_account', idField: 'companyId' },
  quote: { entityType: 'quote', idField: 'quoteId' },
  pipeline: { entityType: 'pipeline', idField: 'pipelineId' },
  deal: { entityType: 'deal', idField: 'dealId' },
  task: { entityType: 'task', idField: 'taskId' },
  segment: { entityType: 'segment', idField: 'segmentId' },
};

function universalTargetForCrm(
  topic: string,
  payload: Record<string, unknown>
): { entityType: string; recordId: string } | null {
  const parts = topic.split('.');
  if (parts[0] !== 'crm' || parts.length < 3) return null;
  const entityKey = parts[1];
  if (!entityKey) return null;
  const map = CRM_UNIVERSAL_BY_ENTITY[entityKey];
  if (!map) return null;
  const recordId = payload[map.idField];
  return typeof recordId === 'string' ? { entityType: map.entityType, recordId } : null;
}

// The local `AUTOMATION_FANIN_TOPIC = 'automation.trigger'` that used to sit
// here is GONE. It was a hand-copy of the constant in @wizeworks/events, justified
// at the time by "this module already owns a PubSub client so it should not
// depend on @wizeworks/events" — reasoning that only held while owning a second
// client was acceptable. It is not: that client is what made this bridge
// no-op on every non-GCP deployment.
//
// The two-bus footgun it guarded (docs/82 §3.3) is unchanged and still real —
// the fan-in tee MUST sit where BOTH crm.* and platform order.* events pass, or
// crm.* triggers never reach automations. It is now handled one layer down, by
// the shared publisher, which tees every publish regardless of which bus it
// came from. See TopicPublisher.fanIn below for why this file no longer does it.

// Publishes through the SHARED transport in @wizeworks/events.
//
// This class used to own `new PubSub({ projectId })` and its own topic cache —
// a third copy of the publisher (api-core held a second, wizeworks/packages/builder a
// fourth). Worse than duplication: `installCrmPubSubBridge` returned early when
// the project id was falsy, so on a non-GCP deployment the bridge did not
// degrade, it published NOTHING. Every `crm.*` event and every teed `order.*`
// stopped at the in-process bus, the commerce-indexer never saw a bridged
// event, and the automation fan-in never fired for a CRM trigger.
//
// The name stays `TopicPublisher` because "topic" is still the right word — on
// NATS the subject IS the event type, exactly as the Pub/Sub topic was.
class TopicPublisher {
  constructor(private readonly inner: Publisher) {}

  async publish(envelope: IndexerEnvelope, _attributes: Record<string, string>): Promise<void> {
    // Attributes are dropped: they were duplicated metadata for Pub/Sub
    // log/DLQ inspection, and every field in them (`type`, `tenantId`,
    // `dedupeKey`) already rides inside the envelope the consumer parses. No
    // subscriber ever read them off the message.
    await publishRaw(this.inner, envelope);
  }

  /** Tee one event onto the automation fan-in (docs/82 §3.3).
   *
   *  A NO-OP now, deliberately: the shared publisher tees EVERY publish to the
   *  fan-in itself, so doing it here as well would deliver each CRM event to the
   *  automation engine twice — and the engine's loop-guard counts depth, not
   *  duplicates, so it would not catch it. Kept as a method rather than deleted
   *  so the two call sites below still read as "publish, then fan in", which is
   *  the contract; the fan-in just happens one layer down. */
  async fanIn(_envelope: IndexerEnvelope): Promise<void> {
    // Intentionally empty — see above.
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

    // Also keep the universal `entities` search index live (docs/39 §6.1): map
    // crm.<entity>.<action> → one generic search.entity.changed so the
    // commerce-indexer re-projects it. One topic, no per-entity subscription;
    // op is always 'upsert' (the indexer deletes when the projector reports the
    // record gone — covering soft-deletes/archives without a delete event).
    const target = universalTargetForCrm(event.topic, event.payload);
    if (target) {
      const indexEnvelope: IndexerEnvelope = {
        type: 'search.entity.changed',
        tenantId: event.tenantId,
        actorId: null,
        occurredAt: (event.occurredAt ?? new Date()).toISOString(),
        data: { entityType: target.entityType, recordId: target.recordId, op: 'upsert' },
      };
      try {
        await this.topics.publish(indexEnvelope, {
          type: 'search.entity.changed',
          tenantId: event.tenantId,
        });
      } catch (err) {
        this.logger.error(
          { err, entityType: target.entityType },
          'crm-pubsub: universal index publish failed'
        );
      }
    }

    // Tee every crm.* event to the automation fan-in (docs/82 §3.3). Best-effort.
    try {
      await this.topics.fanIn(envelope);
    } catch (err) {
      this.logger.error({ err, topic: event.topic }, 'crm-pubsub: fan-in tee failed');
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
      // The two-bus fan-in (docs/82 §3.3): order.* reaches automations via the
      // platform bus, crm.* via the CRM bus above — both must tee or automations
      // see a partial event stream. Best-effort.
      try {
        await this.topics.fanIn(envelope);
      } catch (err) {
        this.logger.error({ err, topic: event.topic }, 'platform-pubsub: fan-in tee failed');
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

// Platform-bus topics teed to the AUTOMATION fan-in. The indexer cares about most
// of the order.* ones; they are teed so an automation can trigger on them (the
// high-value-order seed keys on `order.paid`). The per-topic publish is harmless
// where nothing subscribes it — the fan-in tee is the point.
//
// email.opened/clicked/bounced join them so a tenant can build marketing
// automations that react to ENGAGEMENT ("opened but didn't click in 3 days →
// follow up", "clicked → add a tag / start a sequence"). These are published by
// the Mailgun webhook (public/email-webhook.ts → publishPlatformEvent) which runs
// in api-rest, where this same bridge is installed — so the tee fires there. The
// engagement resolvers (automation-actions/resolvers.ts) hydrate the customer for
// them. Everything else stays in-process (teeing it would publish to a dead topic).
const PLATFORM_TEE_TOPICS: ReadonlySet<string> = new Set([
  'order.created',
  'order.paid',
  'order.cancelled',
  'order.payment.recorded',
  'order.fulfilled',
  'order.delivered',
  'order.refunded',
  'email.opened',
  'email.clicked',
  'email.bounced',
]);

let installed = false;

export interface InstallOptions {
  /** DEPRECATED and ignored. The transport is resolved from EVENT_BROKER. */
  projectId?: string;
  logger: BridgeLogger;
}

/**
 * Install the broker bridges for BOTH the CRM bus and the platform bus.
 * Idempotent.
 *
 * ALWAYS INSTALLS. It used to return early when `projectId` was falsy, which
 * read as "dev parity with the stubs" and was true only while Google Pub/Sub was
 * the sole way to deliver an event. On Azure that early return meant the bridge
 * was permanently off: `crm.*` and teed `order.*` events reached the in-process
 * bus and stopped there, so the commerce-indexer never re-projected a customer
 * and no CRM event ever reached the automation fan-in. Silent, and invisible in
 * any health check.
 *
 * There is nothing left to gate on. The underlying transport decides what
 * happens to a publish — durable on `nats`/`pubsub`, a stdout line on `log` —
 * and it makes that decision once, in @wizeworks/events, for every publisher in the
 * platform.
 *
 * MUST run before `installCrmWebhookFanout()` so the fanout wraps the
 * broker-backed inner publisher rather than the other way round — otherwise a
 * later `setPublisher(fanout)` would wrap the un-bridged publisher and lose the
 * tee. (The fanout reads `getPublisher()` and wraps whatever it finds.)
 */
export function installCrmPubSubBridge({ logger }: InstallOptions): void {
  if (installed) return;

  const topics = new TopicPublisher(createPublisher({ logger }));

  // CRM bus: wrap the active publisher.
  setPublisher(new CrmPubSubPublisher(topics, logger, getPublisher()));

  // Platform bus: wrap the active bus so order.* tees to the broker.
  setPlatformBus(new PubSubTeePlatformBus(getPlatformBus(), topics, logger, PLATFORM_TEE_TOPICS));

  installed = true;
  logger.info(
    { transport: resolveTransport().kind },
    'crm-pubsub: bridges installed (crm.* + order.*)'
  );
}

/** Test hook — reset the install guard between suites. */
export function _resetBridgeForTest(): void {
  installed = false;
}
