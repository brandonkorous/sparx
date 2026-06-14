// Per-topic Pub/Sub publisher. Topic name == event type — subscribers only
// receive events they care about, no fan-out filtering inside worker code.
//
// In dev (`GCP_PROJECT_ID` unset) the publisher logs to the supplied
// logger and otherwise no-ops — useful for quick iteration without a
// Pub/Sub emulator.

import type { Topic } from '@google-cloud/pubsub';
import { PubSub } from '@google-cloud/pubsub';
import { AUTOMATION_FANIN_TOPIC, teeToFanIn } from './fan-in';
import type { EventType, SparxEvent } from './types';

export interface PublisherLogger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export interface Publisher {
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

  if (projectId) {
    const client = new PubSub({ projectId });
    cached = new CloudPubSubPublisher(client);
    logger.info({ projectId }, 'pubsub: Google Cloud publisher initialised (per-topic)');
  } else {
    // Dev: forward to local workers if configured, else log-and-no-op.
    cached = localDispatchFromEnv(logger) ?? new LoggingPublisher(logger);
    if (cached instanceof LoggingPublisher) {
      logger.info({}, 'pubsub: projectId unset — using logging stub');
    }
  }
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

/** Test hook — drop the cached publisher between suites. */
export function _resetPublisherForTest(): void {
  cached = null;
}
