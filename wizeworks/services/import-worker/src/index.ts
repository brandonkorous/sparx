// Import-worker entrypoint. TWO delivery paths onto ONE handler.
//
//   broker (the live one) — a durable JetStream consumer on `import.job.created`.
//     This is how the worker is fed in-cluster on every provider.
//   HTTP push           — a Pub/Sub push subscription POSTs the envelope to `/`.
//     Kept for the GCP deployment and because the probes need a listener anyway.
//
// Pub/Sub push semantics on that second path:
//   2xx (204)        → ack, message consumed.
//   4xx              → permanent reject, no retry.
//   5xx / timeout    → redelivered up to max_delivery_attempts.
//
// The broker path is not an addition for its own sake — without it this worker
// listens on 8080 in a cluster where nothing POSTs to it, so every import job
// api-rest accepts sits at `status: 'pending'` forever while the pod reports
// healthy. That is precisely what it did.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import pino from 'pino';
import { startConsumer } from '@wizeworks/events';
import { env } from './env.js';
import { handle, parseEvent } from './handler.js';

const logger = pino({
  level: env.LOG_LEVEL,
  formatters: { level: (label) => ({ level: label }) },
});

interface PubSubPushEnvelope {
  message: {
    data?: string;
    attributes?: Record<string, string>;
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function decodeOidcEmail(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const [, payloadB64] = authHeader.slice(7).split('.');
  if (!payloadB64) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      email?: unknown;
    };
    return typeof payload.email === 'string' ? payload.email : null;
  } catch {
    return null;
  }
}

async function handlePush(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end();
    return;
  }

  if (env.PUBSUB_INVOKER_SA) {
    const callerEmail = decodeOidcEmail(req.headers.authorization);
    if (callerEmail !== env.PUBSUB_INVOKER_SA) {
      logger.warn({ callerEmail }, 'rejecting push from unexpected invoker SA');
      res.statusCode = 403;
      res.end();
      return;
    }
  }

  let envelope: PubSubPushEnvelope;
  try {
    envelope = JSON.parse(await readBody(req)) as PubSubPushEnvelope;
  } catch (err) {
    logger.error({ err }, 'failed to parse push envelope');
    res.statusCode = 400;
    res.end();
    return;
  }

  const messageId = envelope.message?.messageId;
  if (!envelope.message?.data) {
    logger.warn({ messageId }, 'push envelope missing message.data; acking');
    res.statusCode = 204;
    res.end();
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(envelope.message.data, 'base64').toString('utf8'));
  } catch (err) {
    logger.error({ err, messageId }, 'message data not valid JSON; acking');
    res.statusCode = 204;
    res.end();
    return;
  }

  const event = parseEvent(parsed);
  if (!event) {
    logger.warn(
      { messageId, raw: parsed },
      'message did not match import.job.created schema; acking'
    );
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const outcome = await handle(event, logger);
    logger.info({ messageId, outcome }, 'import job processed');
    res.statusCode = 204;
    res.end();
  } catch (err) {
    logger.error({ err, messageId }, 'transient failure — returning 500 for redelivery');
    res.statusCode = 500;
    res.end();
  }
}

/**
 * Broker path. Decodes the raw JetStream payload and runs the SAME `handle()`
 * the HTTP push path runs — one implementation of what an `import.job.created`
 * DOES, two ways of reaching it.
 *
 * Throwing is meaningful: `startConsumer` nak-s so the broker redelivers. A
 * malformed or off-schema payload is NOT thrown on, for the same reason the HTTP
 * path acks it with a 204 — redelivering something that can never parse burns the
 * retry budget and dead-letters anyway. Only a transient failure deserves a retry.
 */
async function handleFromBroker(raw: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    logger.error({ err }, 'broker message not valid JSON; acking');
    return;
  }

  const event = parseEvent(parsed);
  if (!event) {
    logger.warn({ raw: parsed }, 'broker message did not match import.job.created schema; acking');
    return;
  }

  const outcome = await handle(event, logger);
  logger.info({ outcome }, 'import job processed (broker)');
}

async function main(): Promise<void> {
  // Subscribe to the broker. Returns null when EVENT_BROKER is not `nats`, in
  // which case the HTTP server below is the only delivery path — which is what
  // local dev and a Pub/Sub push deployment both want.
  const consumer = await startConsumer({
    durable: 'import-worker',
    events: ['import.job.created'],
    handle: handleFromBroker,
    logger,
  });

  const server = createServer((req, res) => {
    void handlePush(req, res).catch((err: unknown) => {
      logger.error({ err }, 'unhandled error in push handler');
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end();
      }
    });
  });

  server.listen(env.PORT, '0.0.0.0', () => {
    logger.info({ port: env.PORT }, 'import-worker listening for Pub/Sub pushes');
  });

  function shutdown(signal: NodeJS.Signals): void {
    logger.info({ signal }, 'shutdown received; draining');
    // Drain the subscription FIRST so in-flight handlers finish and their acks
    // land. An unacknowledged message is redelivered rather than lost, but a
    // redelivered import is a duplicated one.
    void consumer?.stop();
    server.close(() => {
      logger.info('server closed; exiting');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 9_000).unref();
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err: unknown) => {
  // A worker that cannot subscribe must not stay up looking healthy while
  // consuming nothing — that is the failure this whole change removes.
  logger.fatal({ err }, 'import-worker failed to start');
  process.exit(1);
});
