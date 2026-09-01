// The event publisher, and the four transports behind it.
//
// Topic/subject name == event type, on every transport — subscribers receive
// only what they asked for, with no fan-out filtering inside worker code.
//
// WHICH transport is decided by `EVENT_BROKER` in ./transport.ts, NOT by
// whether some cloud's project id happens to be set. That distinction is the
// whole point: the old selector was `GCP_PROJECT_ID`, read directly in nine
// domain packages, and a migration to Azure unset it and silently swapped
// production onto a fire-and-forget HTTP path meant for local development.
// Every publish still reported success. Read the header of ./transport.ts
// before changing how a transport is chosen.

import type { Topic } from '@google-cloud/pubsub';
import { PubSub } from '@google-cloud/pubsub';
import { AUTOMATION_FANIN_TOPIC, teeToFanIn, type FanInEnvelope } from './fan-in';
import { resolveTransport } from './transport';
import { NatsJetStreamPublisher } from './transports/nats';
import type { EventType, SparxEvent } from './types';

export interface PublisherLogger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export interface Publisher {
  publish<T>(event: SparxEvent<T>): Promise<void>;
  /**
   * True when this transport THROWS THE EVENT AWAY — the logging stub, and
   * nothing else. Every publisher resolves successfully, so without this a
   * caller cannot tell "queued" from "discarded", and the ones that promise a
   * person something ("check your email") say it either way.
   *
   * It is not a stand-in for `isDurable`: the HTTP dev dispatch is not durable
   * but it does deliver, so a caller that refused to run on anything
   * non-durable would break local development for no reason. This asks the
   * narrower question — did the event go anywhere at all.
   */
  readonly discards?: boolean;
  /**
   * Flush and release the transport's connection.
   *
   * OPTIONAL, and absent on most transports on purpose: a long-lived service
   * never closes its publisher, and only NATS holds a socket that keeps the
   * event loop alive. It exists for the callers that are not servers — an ops
   * script, a one-shot job — which otherwise publish correctly and then hang
   * forever with nothing left to do. That is worse than it sounds in a
   * workflow, where "hangs" reads as "still working" until the job times out.
   */
  close?(): Promise<void>;
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
      // attributes are duplicated metadata for log/DLQ inspection — each
      // subscriber already only sees its own topic.
      attributes: { type: event.type, tenantId: event.tenantId },
    });
    // Tee to the automation fan-in (docs/82 §3.3). Best-effort: the per-type
    // publish above already succeeded, so a fan-in hiccup must not surface as a
    // publish failure (which would mislead the caller / its retry).
    try {
      await teeToFanIn(this.topicFor(AUTOMATION_FANIN_TOPIC), event);
    } catch {
      // swallow — fan-in is additive; one missed automation trigger is recoverable
    }
  }
}

class LoggingPublisher implements Publisher {
  /** The one transport that delivers nothing. Callers with a person waiting on
   *  the far end check this before telling them it was sent. */
  readonly discards = true;

  constructor(private readonly logger: PublisherLogger) {}

  publish<T>(event: SparxEvent<T>): Promise<void> {
    this.logger.info({ event }, '[pubsub:stub] would publish');
    return Promise.resolve();
  }
}

// Dev-only local dispatch. With no `GCP_PROJECT_ID` we must NOT touch prod
// Pub/Sub — but standalone workers (dropship, email, media, …) still need their
// events. This publisher POSTs each event to the matching local worker's HTTP
// push endpoint, in the exact Pub/Sub push envelope the worker already parses —
// so the local path is identical to prod minus the broker. Configured via the
// `SPARX_DEV_WORKER_ROUTES` env (a JSON array of `{ url, events[] }`); when that
// env is absent the publisher falls back to the logging stub.
export interface DevWorkerRoute {
  url: string;
  events: string[];
}

class LocalDispatchPublisher implements Publisher {
  private readonly routes: { url: string; events: Set<string> }[];

  constructor(
    routes: DevWorkerRoute[],
    private readonly logger: PublisherLogger
  ) {
    this.routes = routes.map((r) => ({ url: r.url, events: new Set(r.events) }));
  }

  publish<T>(event: SparxEvent<T>): Promise<void> {
    const targets = this.routes.filter((r) => r.events.has(event.type));
    if (targets.length === 0) {
      // No local worker registered for this type — most events are consumed
      // in-process; only the standalone workers need forwarding.
      this.logger.info({ type: event.type }, '[pubsub:dev-dispatch] no local worker — skipping');
      return Promise.resolve();
    }

    const body = JSON.stringify({
      message: {
        data: Buffer.from(JSON.stringify(event)).toString('base64'),
        attributes: { type: event.type, tenantId: event.tenantId },
        messageId: `dev-${event.occurredAt}`,
        publishTime: event.occurredAt,
      },
      subscription: 'dev-local-dispatch',
    });

    // Fire-and-forget so the publishing request returns immediately, mirroring
    // async Pub/Sub — the worker processes in the background. Failures are
    // logged, never thrown.
    for (const t of targets) {
      void fetch(t.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(120_000),
      }).then(
        (res) => {
          if (!res.ok) {
            this.logger.warn(
              { url: t.url, status: res.status, type: event.type },
              '[pubsub:dev-dispatch] worker returned non-2xx'
            );
          }
        },
        (err: unknown) => {
          this.logger.warn(
            { url: t.url, type: event.type, err: err instanceof Error ? err.message : String(err) },
            '[pubsub:dev-dispatch] worker POST failed (is the worker running?)'
          );
        }
      );
    }
    return Promise.resolve();
  }
}

/** Parse `SPARX_DEV_WORKER_ROUTES` into a publisher, or null if unset/invalid.
 *  Shared by `createPublisher` (this package) and api-core's `getPublisher` so
 *  both publish paths forward to local workers in dev. */
export function localDispatchFromEnv(logger: PublisherLogger): Publisher | null {
  const raw = process.env.SPARX_DEV_WORKER_ROUTES;
  if (!raw) return null;
  try {
    const routes = JSON.parse(raw) as DevWorkerRoute[];
    if (!Array.isArray(routes) || routes.length === 0) return null;
    logger.info(
      { routes: routes.length },
      'pubsub: dev local-dispatch — forwarding to local workers'
    );
    return new LocalDispatchPublisher(routes, logger);
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      'pubsub: SPARX_DEV_WORKER_ROUTES is not valid JSON — ignoring'
    );
    return null;
  }
}

let cached: Publisher | null = null;

export interface CreatePublisherOptions {
  projectId?: string;
  logger: PublisherLogger;
}

export function createPublisher({ projectId, logger }: CreatePublisherOptions): Publisher {
  if (cached) return cached;

  // `projectId` is DEPRECATED and deliberately no longer selects anything. It
  // used to: passing it meant Pub/Sub and omitting it meant a fire-and-forget
  // HTTP fallback, so nine domain packages each read `process.env.GCP_PROJECT_ID`
  // to make that decision — and a cloud migration that unset it downgraded
  // production to a dev transport without a single error. The transport is now
  // resolved from `EVENT_BROKER` in ./transport.ts, which fails loudly instead.
  //
  // Still accepted so a caller passing it is not a type error mid-migration; it
  // is only a fallback for `EVENT_BROKER_PROJECT` when pubsub is explicitly
  // selected. Remove the parameter once no call site passes it.
  const transport = resolveTransport(
    projectId && !process.env.EVENT_BROKER_PROJECT
      ? { ...process.env, EVENT_BROKER_PROJECT: projectId }
      : process.env
  );

  switch (transport.kind) {
    case 'nats':
      cached = new NatsJetStreamPublisher(transport.url, transport.stream, logger);
      logger.info(
        { url: transport.url, stream: transport.stream },
        'events: NATS JetStream transport'
      );
      break;

    case 'pubsub':
      cached = new CloudPubSubPublisher(new PubSub({ projectId: transport.projectId }));
      logger.info(
        { projectId: transport.projectId },
        'events: Google Pub/Sub transport (per-topic)'
      );
      break;

    case 'http':
      // Reachable only outside production — resolveTransport refuses it under
      // NODE_ENV=production, which is the guard that was missing.
      cached = new LocalDispatchPublisher(transport.routes, logger);
      logger.warn(
        { routes: transport.routes.length },
        'events: HTTP dev dispatch — NO queue, retry or dead-letter. Events published while a worker is down are lost.'
      );
      break;

    case 'log':
      cached = new LoggingPublisher(logger);
      logger.info({}, 'events: logging stub — events are DISCARDED');
      break;
  }

  // The switch above is exhaustive over the Transport union, so `cached` is
  // always assigned by the time control reaches here.
  return cached;
}

/**
 * Convenience: build the event envelope + publish. Most callers want this
 * rather than constructing a SparxEvent themselves.
 *
 * NEVER fails the calling request because Pub/Sub is down — catches and
 * logs. If a caller needs guaranteed delivery, it should construct the
 * publisher and handle errors itself.
 */
export async function publishEvent<T>(
  publisher: Publisher,
  type: EventType,
  tenantId: string,
  actorId: string | null,
  data: T,
  logger: PublisherLogger
): Promise<void> {
  const event: SparxEvent<T> = {
    type,
    tenantId,
    actorId,
    occurredAt: new Date().toISOString(),
    data,
  };
  try {
    await publisher.publish(event);
  } catch (err) {
    logger.error({ err, event }, 'pubsub: publish failed');
  }
}

/**
 * Publish an envelope whose `type` is not (yet) in the canonical `EventType`
 * union — the CRM bridge's `crm.*` topics and the builder bridge's `builder.*`.
 *
 * Exists so those bridges stop carrying their OWN Pub/Sub client. There were
 * four copies of the publisher in this repo: here, in api-core, in
 * wizeworks/packages/crm/pubsub-bridge and in wizeworks/packages/builder/pubsub-bridge. Each
 * constructed `new PubSub({ projectId })` and each returned early when the
 * project id was absent — so on Azure the CRM and builder bridges did not
 * degrade, they published NOTHING, and the commerce-indexer never saw a single
 * bridged event.
 *
 * The cast is safe and deliberate: every transport reads only `type`,
 * `tenantId` and `data` off the envelope. Widening `SparxEvent['type']` to
 * `string` instead would delete the compile-time checking that keeps ordinary
 * `publishEvent` callers honest, which is worth far more than avoiding one cast
 * in the two places that genuinely publish outside the union.
 */
export async function publishRaw(publisher: Publisher, envelope: FanInEnvelope): Promise<void> {
  await publisher.publish(envelope as SparxEvent<unknown>);
}

/** Test hook — drop the cached publisher between suites. */
export function _resetPublisherForTest(): void {
  cached = null;
}
