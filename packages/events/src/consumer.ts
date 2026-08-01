// The consuming half of the broker.
//
// Workers used to receive events as HTTP POSTs carrying a Pub/Sub PUSH envelope
// — a shape that exists because Cloud Run has no long-lived process to hold a
// subscription open. On Kubernetes every worker IS a long-lived Deployment, so
// a pull consumer is both simpler and strictly better: the broker holds the
// message until the worker acknowledges it, which is what makes a rolling
// restart lossless instead of a window where events disappear.
//
// DELIVERY SEMANTICS, and why each choice is the one that matters here:
//
//   • Durable consumer, named per worker. The cursor lives on the SERVER, so a
//     pod that restarts resumes where it stopped rather than replaying from the
//     start or skipping what it missed while down.
//   • Explicit ack. `handle()` returning is what acknowledges; a throw does not.
//   • Nak with backoff on failure, so a transient error (a database blip, a
//     provider timeout) is retried instead of silently swallowed the way the
//     fire-and-forget HTTP path swallowed everything.
//   • `max_deliver` bounds the retries. A message that fails that many times is
//     a poison pill and goes to the dead-letter subject rather than blocking
//     the consumer forever — the failure mode that turns one bad event into an
//     outage for every event behind it.
//
// The worker's existing `handle()` is reused verbatim. This is deliberately not
// a second code path: the HTTP entrypoint each worker still exposes (used by
// local dev and by a Pub/Sub push deployment) calls the same function, so there
// is one implementation of what an event DOES and two ways to deliver it.

import { ensureStream, subjectFor } from './transports/nats';
import type { PublisherLogger } from './publisher';
import { resolveTransport } from './transport';

export interface ConsumerOptions {
  /** Durable consumer name. Stable per worker — changing it restarts the cursor. */
  durable: string;
  /** Event types this worker consumes. Mapped to `sparx.<type>` subjects. */
  events: string[];
  /** Invoked per message. Returning acknowledges; throwing triggers a retry. */
  handle: (raw: string) => Promise<void>;
  logger: PublisherLogger;
  /** Redelivery attempts before the message is treated as poison. */
  maxDeliver?: number;
}

export interface RunningConsumer {
  stop(): Promise<void>;
}

/**
 * Subscribe to this worker's subjects and dispatch to `handle`.
 *
 * Returns null when the configured transport is not NATS — under `http` or
 * `log` the worker is driven by its HTTP endpoint instead, and starting a
 * broker subscription would either duplicate every delivery or fail to connect.
 * Callers should treat null as "the HTTP path is in charge", not as an error.
 */
export async function startConsumer(opts: ConsumerOptions): Promise<RunningConsumer | null> {
  const transport = resolveTransport();
  if (transport.kind !== 'nats') {
    opts.logger.info(
      { transport: transport.kind, durable: opts.durable },
      'events: not a broker transport — consuming over HTTP instead'
    );
    return null;
  }

  const { connect, AckPolicy, DeliverPolicy } = await import('nats');
  const conn = await connect({
    servers: transport.url,
    name: opts.durable,
    // Reconnect indefinitely. A broker restart must never leave a worker
    // permanently detached while its pod still reports healthy — that is
    // exactly the "running but delivering nothing" state this replaced.
    maxReconnectAttempts: -1,
  });

  const js = conn.jetstream();
  const jsm = await conn.jetstreamManager();
  const subjects = opts.events.map(subjectFor);

  // A worker can win the race to boot before any publisher has connected, and
  // `consumers.add` against a missing stream fails. Same idempotent call the
  // publisher makes — whichever process gets there first creates it.
  await ensureStream(jsm, transport.stream);

  // Idempotent: re-running with the same durable name updates the consumer in
  // place rather than creating a second one. Two consumers on one durable would
  // split the stream between them and each worker would see half its events.
  await jsm.consumers.add(transport.stream, {
    durable_name: opts.durable,
    ack_policy: AckPolicy.Explicit,
    // New pods pick up everything still unacknowledged, including what arrived
    // while the worker was down. `DeliverNew` would skip precisely those.
    deliver_policy: DeliverPolicy.All,
    filter_subjects: subjects,
    max_deliver: opts.maxDeliver ?? 5,
    ack_wait: 120_000_000_000, // 2 minutes in nanoseconds — matches the old HTTP timeout
  });

  const consumer = await js.consumers.get(transport.stream, opts.durable);
  const messages = await consumer.consume();

  opts.logger.info(
    { durable: opts.durable, subjects: subjects.length, stream: transport.stream },
    'events: JetStream consumer started'
  );

  // Detached loop. Not awaited: `consume()` yields until the connection closes,
  // so awaiting here would never return and the caller could not finish booting.
  void (async () => {
    for await (const m of messages) {
      try {
        await opts.handle(new TextDecoder().decode(m.data));
        m.ack();
      } catch (err) {
        // nak() with a delay rather than term(): the broker redelivers up to
        // max_deliver, after which JetStream drops it to the dead-letter
        // subject on its own. Losing the message here would reproduce the bug.
        m.nak(5_000);
        opts.logger.error(
          {
            durable: opts.durable,
            subject: m.subject,
            attempt: m.info.redeliveryCount,
            err: err instanceof Error ? err.message : String(err),
          },
          'events: handler failed — message nak-ed for redelivery'
        );
      }
    }
  })();

  return {
    async stop() {
      // drain() lets in-flight handlers finish and their acks land before the
      // socket closes, so a rolling restart does not orphan work mid-flight.
      await conn.drain();
    },
  };
}
