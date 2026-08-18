// NATS JetStream — the portable durable transport.
//
// Chosen over a managed queue because it runs identically on GKE, AKS, EKS and
// a laptop: one StatefulSet, no cloud API, no per-provider adapter, nothing to
// re-procure when the platform moves. Google Pub/Sub remains available behind
// the same interface (see ./pubsub.ts) for a GCP deployment that wants it, but
// it is now A choice rather than THE implementation.
//
// SUBJECTS. `sparx.<eventType>` — so `order.placed` publishes to
// `sparx.order.placed`. The prefix exists so the stream can bind `sparx.>`
// without laying claim to every subject on the server, and so a consumer's
// filter is unambiguous. Topic-name == event-type is preserved underneath it:
// subscribers still receive only what they asked for, with no fan-out filtering
// inside worker code.
//
// ACKNOWLEDGEMENT is the entire point. `js.publish()` resolves only once the
// server has persisted the message to the stream, so a publish that returns has
// genuinely been accepted — unlike the fire-and-forget HTTP path this replaced,
// where a `fetch()` nobody awaited "succeeded" whether or not anything received
// it.

import type { Publisher, PublisherLogger } from '../publisher';
import type { SparxEvent } from '../types';
import { AUTOMATION_FANIN_TOPIC, buildFanIn } from '../fan-in';

/** Subject prefix. Keeps the stream's binding narrow and consumer filters exact. */
export const SUBJECT_PREFIX = 'sparx';

export function subjectFor(eventType: string): string {
  return `${SUBJECT_PREFIX}.${eventType}`;
}

// Minimal structural types for the bits of `nats` used here. Declared locally
// rather than imported so the dependency stays behind the dynamic import below
// — a static `import type` from 'nats' would be erased at runtime but still
// couple this module's compilation to the package, and these two methods are
// the entire surface used. TypeScript checks the real client against them
// structurally at the import site, so they cannot drift silently.
interface JetStreamClient {
  publish(subject: string, payload: Uint8Array, opts?: unknown): Promise<{ seq: number }>;
}
interface NatsConnection {
  jetstream(): JetStreamClient;
  jetstreamManager(): Promise<JetStreamManager>;
  drain(): Promise<void>;
}

/**
 * Create the stream if it is absent, idempotently.
 *
 * Deliberately done in CODE rather than by a provisioning Job or a Terraform
 * resource. A Job is another manifest to keep in step with the code that
 * depends on it, and a Terraform resource would put the broker's schema behind
 * a provider — which is the coupling this whole change removes. Doing it on
 * connect means a fresh cluster, a laptop, and a CI container are all correct
 * with no setup step, which is the portability claim actually holding up.
 *
 * `subjects: sparx.>` binds every event subject at once, so adding an event
 * type needs no infrastructure change. Contrast Pub/Sub, where topic-per-type
 * meant a Terraform entry per event and four separate silent publish failures
 * when one was forgotten (the `EventType` ↔ topic parity check in CI exists
 * because of exactly that).
 */
export async function ensureStream(jsm: JetStreamManager, stream: string): Promise<void> {
  try {
    await jsm.streams.info(stream);
  } catch {
    // Absent → create. A race between two booting pods is harmless: the loser
    // gets "stream name already in use", which is the state it wanted anyway.
    try {
      await jsm.streams.add({
        name: stream,
        subjects: [`${SUBJECT_PREFIX}.>`],
        // File-backed and bounded, matching k8s/self-hosted/nats.yaml. An
        // unbounded stream fills the volume and then rejects every publish.
        max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 days in nanoseconds
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/already in use|already exists/i.test(msg)) throw err;
    }
  }
}

interface JetStreamManager {
  streams: {
    info(name: string): Promise<unknown>;
    add(cfg: { name: string; subjects: string[]; max_age?: number }): Promise<unknown>;
  };
}

export class NatsJetStreamPublisher implements Publisher {
  private conn: NatsConnection | null = null;
  private js: JetStreamClient | null = null;
  private connecting: Promise<void> | null = null;

  constructor(
    private readonly url: string,
    private readonly stream: string,
    private readonly logger: PublisherLogger
  ) {}

  /**
   * Connect on first publish, once. Concurrent callers await the same promise
   * rather than opening a connection each — the publisher is a module-level
   * singleton and every route handler shares it.
   */
  private async connect(): Promise<JetStreamClient> {
    if (this.js) return this.js;
    this.connecting ??= (async () => {
      // Dynamic import: the client is only loaded when this transport is
      // actually SELECTED, so a Pub/Sub deployment never pays for it and a
      // unit test on the logging stub does not need a broker library resolved
      // at all. Static-importing it here would pull the whole NATS client into
      // every service that imports @wizeworks/events, which is all of them.
      const { connect } = await import('nats');
      const conn = await connect({
        servers: this.url,
        name: process.env.SPARX_SERVICE_NAME ?? 'sparx',
        // Reconnect forever. A broker restart must not permanently break a
        // long-lived API process — the alternative is a pod that looks
        // healthy and silently stops delivering, which is the failure mode
        // this whole change exists to remove.
        maxReconnectAttempts: -1,
      });
      this.conn = conn;
      // Publishing to a subject no stream binds is silently accepted by core
      // NATS and dropped — indistinguishable from success, which is the exact
      // failure class this transport replaced. Ensure the stream exists
      // BEFORE the first publish rather than trusting a provisioning step to
      // have run.
      await ensureStream(await conn.jetstreamManager(), this.stream);
      this.js = conn.jetstream();
      this.logger.info({ url: this.url, stream: this.stream }, 'events: NATS JetStream connected');
    })().catch((err: unknown) => {
      // Clear the latch so the NEXT publish retries instead of inheriting a
      // permanently rejected promise.
      this.connecting = null;
      throw err;
    });
    await this.connecting;
    // Assigned by the IIFE above before it resolves; a failure rejects rather
    // than falling through, so reaching here means the client exists.
    return this.js!;
  }

  async publish<T>(event: SparxEvent<T>): Promise<void> {
    const js = await this.connect();
    const payload = new TextEncoder().encode(JSON.stringify(event));

    // Awaited: resolves only after the server has persisted to the stream. A
    // rejection propagates to the caller, which is what makes a delivery
    // failure observable at all.
    await js.publish(subjectFor(event.type), payload);

    // Tee to the automation fan-in (docs/82 §3.3). Best-effort by design: the
    // per-type publish above already succeeded, so a fan-in hiccup must not
    // surface as a publish failure and mislead the caller's retry.
    try {
      const { envelope } = buildFanIn(event);
      await js.publish(
        subjectFor(AUTOMATION_FANIN_TOPIC),
        new TextEncoder().encode(JSON.stringify(envelope))
      );
    } catch (err) {
      this.logger.warn(
        { type: event.type, err: err instanceof Error ? err.message : String(err) },
        'events: automation fan-in tee failed (additive; one missed trigger is recoverable)'
      );
    }
  }

  /** Flush and close. For graceful shutdown hooks. */
  async close(): Promise<void> {
    await this.conn?.drain();
    this.conn = null;
    this.js = null;
    this.connecting = null;
  }
}
