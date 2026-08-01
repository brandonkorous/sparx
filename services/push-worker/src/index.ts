// Cloud Run entrypoint. Pub/Sub pushes `push.send` to POST / — we verify the
// OIDC token's `email` claim, dispatch to handle(), and respond 204 (ack) /
// 5xx (nack-and-retry). Mirrors services/email-worker/src/index.ts.
//
// Pub/Sub push semantics:
//   - 2xx (204)                   → ack, no retry
//   - 4xx                         → permanent reject, no retry
//   - 5xx / no response / timeout → redelivered up to max_delivery_attempts

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import pino from 'pino';
import { env } from './env.js';
import { configureVapid, handle, parseEvent } from './handler.js';
import { startConsumer } from '@sparx/events';

const logger = pino({
  level: env.LOG_LEVEL,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
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
    logger.warn({ messageId, raw: parsed }, 'message did not match push.send schema; acking');
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const outcome = await handle(event, logger);
    logger.info({ messageId, ...outcome }, 'push.send processed');
    res.statusCode = 204;
    res.end();
  } catch (err) {
    logger.error(
      { err, messageId },
      'transient push failure — returning 500 to trigger redelivery'
    );
    res.statusCode = 500;
    res.end();
  }
}

function main(): void {
  // Surface the VAPID config state at boot (no-op delivery if unset).
  logger.info({ vapidConfigured: configureVapid() }, 'push-worker VAPID state');

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
    logger.info({ port: env.PORT }, 'push-worker listening for Pub/Sub pushes');
  });

  function shutdown(signal: NodeJS.Signals): void {
    logger.info({ signal }, 'shutdown received; draining');
    server.close(() => {
      logger.info('server closed; exiting');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 9_000).unref();
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

try {
  main();
} catch (err) {
  logger.fatal({ err }, 'push-worker failed to start');
  process.exit(1);
}

// ─── Broker subscription ─────────────────────────────────────────────────────
// Registered at module scope so this stays one self-contained block and the
// entrypoint above needs no restructuring. Resolves to null unless
// EVENT_BROKER=nats, in which case the HTTP server remains the only delivery
// path — which is what local dev and a Pub/Sub push deployment both want.
//
// This is the half that makes delivery lossless. The HTTP path it sits beside
// is fire-and-forget from the publisher's side: an event published while this
// pod was restarting was simply gone. JetStream holds the message until
// `handle()` returns, and a throw nak-s it for redelivery.
async function handleFromBroker(raw: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    logger.error({ err }, 'push-worker: broker message not valid JSON; acking');
    return;
  }

  const event = parseEvent(parsed);
  if (!event) {
    // Off-schema is permanent, so ack it. Redelivering something that can never
    // parse only burns the retry budget before dead-lettering it anyway.
    logger.warn({ raw: parsed }, 'push-worker: broker message did not match schema; acking');
    return;
  }

  // Throwing here is deliberate: startConsumer nak-s so the broker redelivers.
  await handle(event, logger);
}

void startConsumer({
  durable: 'push-worker',
  events: ['push.send'],
  handle: handleFromBroker,
  logger,
})
  .then((consumer) => {
    if (!consumer) return;
    // Drain on shutdown so in-flight handlers finish and their acks land. An
    // unacknowledged message is redelivered rather than lost, but a redelivered
    // side effect is a duplicate one.
    const drain = (): void => void consumer.stop();
    process.once('SIGTERM', drain);
    process.once('SIGINT', drain);
  })
  .catch((err: unknown) => {
    // A worker that cannot subscribe must not stay up looking healthy while
    // consuming nothing — that is the failure this whole change removes.
    logger.fatal({ err }, 'push-worker: broker subscription failed');
    process.exit(1);
  });
