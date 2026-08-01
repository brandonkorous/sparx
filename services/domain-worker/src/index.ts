// Cloud Run entrypoint. Same shape as services/email-worker/src/index.ts.
//
// Routes:
//   POST /                              — Pub/Sub push for domain.purchased
//   POST /internal/cron/renewal-check  — nightly renewal reminder check
//
// Pub/Sub push semantics:
//   204 → ack (no retry)
//   400 → permanent reject (malformed envelope)
//   500 → nack, Pub/Sub redelivers with exponential backoff

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import pino from 'pino';
import { env } from './env.js';
import { parseDomainPurchasedEvent, handleDomainPurchased } from './handler.js';
import { runRenewalCheck } from './cron.js';
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

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end();
    return;
  }

  const url = req.url ?? '/';

  // ── POST /internal/cron/renewal-check ────────────────────────────────────
  if (url === '/internal/cron/renewal-check') {
    const token = req.headers['x-sparx-internal-cron-token'];
    if (!env.SPARX_INTERNAL_CRON_TOKEN || token !== env.SPARX_INTERNAL_CRON_TOKEN) {
      res.statusCode = 403;
      res.end();
      return;
    }
    try {
      const result = await runRenewalCheck(logger);
      logger.info(result, 'renewal check complete');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    } catch (err) {
      logger.error({ err }, 'renewal check failed');
      res.statusCode = 500;
      res.end();
    }
    return;
  }

  // ── POST / — Pub/Sub push ─────────────────────────────────────────────────
  if (url !== '/') {
    res.statusCode = 404;
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

  const event = parseDomainPurchasedEvent(parsed);
  if (!event) {
    logger.warn(
      { messageId, raw: parsed },
      'message did not match domain.purchased schema; acking'
    );
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    await handleDomainPurchased(event, logger);
    res.statusCode = 204;
    res.end();
  } catch (err) {
    logger.error(
      { err, messageId, domain: event.data.domain },
      'domain processing failed; returning 500 for Pub/Sub retry'
    );
    res.statusCode = 500;
    res.end();
  }
}

function main(): void {
  const server = createServer((req, res) => {
    void handleRequest(req, res).catch((err: unknown) => {
      logger.error({ err }, 'unhandled error in request handler');
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end();
      }
    });
  });

  server.listen(env.PORT, '0.0.0.0', () => {
    logger.info({ port: env.PORT }, 'domain-worker listening');
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
  logger.fatal({ err }, 'domain-worker failed to start');
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
    logger.error({ err }, 'domain-worker: broker message not valid JSON; acking');
    return;
  }

  const event = parseDomainPurchasedEvent(parsed);
  if (!event) {
    // Off-schema is permanent, so ack it. Redelivering something that can never
    // parse only burns the retry budget before dead-lettering it anyway.
    logger.warn({ raw: parsed }, 'domain-worker: broker message did not match schema; acking');
    return;
  }

  // Throwing here is deliberate: startConsumer nak-s so the broker redelivers.
  await handleDomainPurchased(event, logger);
}

void startConsumer({
  durable: 'domain-worker',
  events: ['domain.purchased'],
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
    logger.fatal({ err }, 'domain-worker: broker subscription failed');
    process.exit(1);
  });
