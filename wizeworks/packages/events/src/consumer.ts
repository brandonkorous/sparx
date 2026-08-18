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
// The worker's existing `handle()` is reused verbatim — there is one
// implementation of what an event DOES, and the broker is how it is delivered.

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
 * What one handler subscribes to. Declared by each worker package and registered
 * by `wizeworks/services/event-worker`, which is the single process that runs them.
 *
 * `durable` is JetStream's cursor key and MUST stay stable across the move from
 * "one pod per handler" to one shared pod — a renamed durable is a brand-new
 * consumer, which replays or skips depending on the stream's deliver policy.
 */
export interface WorkerSubscription {
  durable: string;
  events: string[];
  handle: (raw: string) => Promise<void>;
}

/**
 * The parse-and-ack wrapper every worker had its own copy of.
 *
 * All twelve were the same twenty-five lines with a different name in the log
 * message: JSON.parse, schema-check, then call `handle`. The two ack decisions
 * are the part worth stating once rather than twelve times:
 *
 *   • Unparseable JSON and off-schema payloads are ACKED, not retried. Both are
 *     permanent — redelivering something that can never parse only burns the
 *     retry budget before dead-lettering it anyway.
 *   • Anything `handle` throws propagates, so `startConsumer` naks and the
 *     broker redelivers. That is the transient-failure path and it must stay a
 *     throw; swallowing it here would silently drop real work.
 */
export function createBrokerHandler<E, L extends PublisherLogger>(opts: {
  /** Worker name, used only to make the log lines attributable. */
  name: string;
  logger: L;
  parseEvent: (raw: unknown) => E | null;
  handle: (event: E, logger: L) => Promise<unknown>;
}): (raw: string) => Promise<void> {
  return async function handleFromBroker(raw: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      opts.logger.error({ err }, `${opts.name}: broker message not valid JSON; acking`);
      return;
    }

    const event = opts.parseEvent(parsed);
    if (!event) {
      opts.logger.warn(
        { raw: parsed },
        `${opts.name}: broker message did not match schema; acking`
      );
      return;
    }

    await opts.handle(event, opts.logger);
  };
}

/**
 * Is this the "a durable by that name exists, with a different config" refusal?
 *
 * Matched on JetStream's `err_code` (10148) rather than the message text, which
 * is server-version-dependent; the text is kept as a fallback for a broker that
 * does not send the structured code.
 */
function isConsumerConfigDrift(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const candidate = err as { api_error?: { err_code?: number }; message?: string };
  if (candidate.api_error?.err_code === 10148) return true;
  return (
    typeof candidate.message === 'string' && candidate.message.includes('consumer already exists')
  );
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

  // ── ADD, THEN CONVERGE ────────────────────────────────────────────────────
  //
  // `consumers.add` is idempotent ONLY for a byte-identical config. Re-running
  // it with a DIFFERENT one — most commonly a widened `filter_subjects`, which
  // is what adding an event to a shipped handler's list does — is rejected with
  // 400 / err_code 10148, "consumer already exists".
  //
  // This file and `@wizeworks/finance-worker` both used to claim add upserts. It
  // does not, and the cost of believing it was the whole worker fleet:
  // `finance-worker` gained `module.activated`, the add was refused on boot, and
  // because every handler shares ONE process a single refused subscription took
  // all fourteen down. It stayed hidden only because the release's rollout gate
  // was itself broken and had been skipping the restart.
  //
  // So: add, and on that one error converge the existing consumer instead.
  // `update` is the right verb rather than delete-and-recreate — it keeps the
  // delivered/ack floor, which is the entire reason `services/CLAUDE.md` calls a
  // durable name permanent. Only genuinely mutable fields are sent; `ack_policy`
  // and `deliver_policy` are immutable by design and are not ours to change on a
  // live cursor.
  const desired = {
    ack_wait: 120_000_000_000, // 2 minutes in nanoseconds — matches the old HTTP timeout
    max_deliver: opts.maxDeliver ?? 5,
    filter_subjects: subjects,
  };

  try {
    await jsm.consumers.add(transport.stream, {
      durable_name: opts.durable,
      ack_policy: AckPolicy.Explicit,
      // New pods pick up everything still unacknowledged, including what arrived
      // while the worker was down. `DeliverNew` would skip precisely those.
      deliver_policy: DeliverPolicy.All,
      ...desired,
    });
  } catch (err) {
    if (!isConsumerConfigDrift(err)) throw err;
    // Logged rather than silent: this is the moment a shipped consumer's shape
    // changes, and "which release widened finance-worker" is a question someone
    // will ask when a replay shows up.
    opts.logger.info(
      { durable: opts.durable, subjects: subjects.length, stream: transport.stream },
      'events: durable exists with a different config — updating it in place, cursor kept'
    );
    await jsm.consumers.update(transport.stream, opts.durable, desired);
  }

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
