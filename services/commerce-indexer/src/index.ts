// Cloud Run entrypoint. Pub/Sub pushes commerce events to POST /; we
// decode the OIDC token's `email` claim (defense in depth on top of
// Cloud Run's own auth check), dispatch to the event router, and respond
// 204 (ack) / 5xx (nack-and-retry).
//
// Same shape as services/media-worker and services/email-worker so
// operational tooling (log queries, alerts, the deploy workflow) stays
// uniform across the worker fleet.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import pino from 'pino';

import { ensureSchemas, ensureSynonyms } from '@sparx/search';

import { env } from './env.js';
import { handleEvent, type CommerceEventEnvelope } from './handler.js';
import { startConsumer } from '@sparx/events';

interface PubSubPushEnvelope {
  message: {
    data?: string;
    attributes?: Record<string, string>;
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

const logger = pino({
  level: env.LOG_LEVEL,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

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

function parseEvent(raw: unknown): CommerceEventEnvelope | null {
  const e = raw as Partial<CommerceEventEnvelope> | undefined;
  if (!e || typeof e.type !== 'string') return null;
  return e as CommerceEventEnvelope;
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
    logger.warn({ messageId }, 'event payload did not match envelope shape; acking');
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const result = await handleEvent(event, logger);
    logger.info(
      { messageId, type: event.type, tenantId: event.tenantId, ...result },
      'event processed'
    );
    res.statusCode = 204;
    res.end();
  } catch (err) {
    logger.error(
      { err, messageId, type: event.type, tenantId: event.tenantId },
      'unhandled handler error'
    );
    res.statusCode = 500;
    res.end();
  }
}

async function main(): Promise<void> {
  if (env.ENSURE_SCHEMAS_ON_BOOT) {
    try {
      const out = await ensureSchemas();
      logger.info(out, 'typesense schemas ensured');
      // Synonyms ride on the same admin-key boot step (collection must exist
      // first). Best-effort + separate try so a synonym hiccup doesn't undo a
      // successful schema ensure — search still works without synonyms.
      try {
        const syn = await ensureSynonyms();
        logger.info(syn, 'typesense synonyms ensured');
      } catch (err) {
        logger.error({ err }, 'failed to ensure typesense synonyms; continuing');
      }
    } catch (err) {
      // Don't crash — schema creation requires an admin API key the
      // search-only key won't have. Log loudly and continue; the worker
      // can still upsert if the collections exist.
      logger.error({ err }, 'failed to ensure typesense schemas; continuing');
    }
  }

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
    logger.info({ port: env.PORT }, 'commerce-indexer listening for Pub/Sub pushes');
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

main().catch((err: unknown) => {
  logger.fatal({ err }, 'commerce-indexer failed to start');
  process.exit(1);
});

// ─── Broker subscription ─────────────────────────────────────────────────────
// Module scope, so the entrypoint above needs no restructuring. Resolves to
// null unless EVENT_BROKER=nats, leaving the HTTP server as the only delivery
// path for local dev and for a Pub/Sub push deployment.
//
// This is the half that makes delivery lossless: the HTTP path is
// fire-and-forget from the publisher's side, so an event published while this
// pod was restarting was simply gone.
async function handleFromBroker(raw: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    logger.error({ err }, 'commerce-indexer: broker message not valid JSON; acking');
    return;
  }

  const event = parseEvent(parsed);
  if (!event) {
    // Off-schema is permanent — ack rather than burn the retry budget.
    logger.warn({ raw: parsed }, 'commerce-indexer: broker message did not match schema; acking');
    return;
  }

  // Throwing nak-s the message for redelivery. handleEvent already treats a
  // Typesense outage as retryable, which is exactly what a broker is for.
  await handleEvent(event, logger);
}

void startConsumer({
  durable: 'commerce-indexer',
  events: [
    'product.created',
    'product.updated',
    'product.deleted',
    'variant.created',
    'variant.updated',
    'variant.deleted',
    'inventory.adjusted',
    'order.cancelled',
    'order.fulfilled',
    'order.delivered',
    'order.refunded',
    'search.reindex.requested',
    'search.entity.changed',
  ],
  handle: handleFromBroker,
  logger,
})
  .then((consumer) => {
    if (!consumer) return;
    const drain = (): void => void consumer.stop();
    process.once('SIGTERM', drain);
    process.once('SIGINT', drain);
  })
  .catch((err: unknown) => {
    logger.fatal({ err }, 'commerce-indexer: broker subscription failed');
    process.exit(1);
  });
