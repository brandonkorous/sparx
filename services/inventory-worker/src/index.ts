// inventory-worker entrypoint. TWO delivery paths onto ONE handler: a durable
// JetStream consumer (the live one in-cluster, on every provider) and a Pub/Sub
// push POST to `/` (the GCP deployment, and what the probes need a listener for).
// Same OIDC check + dispatch pattern as dropship-worker and email-worker.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import pino from 'pino';
import { startConsumer } from '@sparx/events';
import { env } from './env.js';
import { handle, parseEvent } from './handler.js';

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
  if (req.method === 'GET' && req.url === '/healthz') {
    res.writeHead(200).end('ok');
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405).end('method not allowed');
    return;
  }

  if (env.PUBSUB_INVOKER_SA) {
    const callerEmail = decodeOidcEmail(req.headers.authorization);
    if (callerEmail !== env.PUBSUB_INVOKER_SA) {
      logger.warn({ callerEmail }, 'inventory-worker: OIDC SA mismatch — rejecting');
      res.writeHead(403).end('forbidden');
      return;
    }
  }

  let body: string;
  try {
    body = await readBody(req);
  } catch (err) {
    logger.error({ err }, 'inventory-worker: failed to read body');
    res.writeHead(500).end('read error');
    return;
  }

  let envelope: PubSubPushEnvelope;
  try {
    envelope = JSON.parse(body) as PubSubPushEnvelope;
  } catch {
    logger.warn('inventory-worker: invalid JSON body — permanent reject');
    res.writeHead(400).end('bad request');
    return;
  }

  const event = parseEvent(envelope.message);
  if (!event) {
    logger.warn(
      { messageId: envelope.message.messageId },
      'inventory-worker: unparseable event — acking'
    );
    res.writeHead(204).end();
    return;
  }

  const eventLog = logger.child({
    eventType: event.type,
    tenantId: event.tenantId,
    messageId: envelope.message.messageId,
  });

  try {
    await handle(event, eventLog);
    res.writeHead(204).end();
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    eventLog.error({ err: errMsg }, 'inventory-worker: handler threw — will retry');
    res.writeHead(500).end('internal error');
  }
}

/**
 * Broker path — the live one in-cluster. Runs the SAME `handle()` the HTTP push
 * path runs; without it this worker listens on 8080 in a cluster where nothing
 * POSTs to it, so a source sync api-rest kicks off never runs while the pod
 * reports healthy.
 *
 * Throwing is deliberate: `startConsumer` nak-s so the broker redelivers. Only a
 * transient failure earns that — an off-schema payload is acked, since
 * redelivering something that can never parse just burns the retry budget.
 */
async function handleFromBroker(raw: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err: unknown) {
    logger.error({ err }, 'inventory-worker: broker message not valid JSON; acking');
    return;
  }

  // This worker's `parseEvent` takes the Pub/Sub PUSH MESSAGE (base64 `data`),
  // not the decoded event. Re-wrap rather than duplicate its validation here — a
  // second copy of those checks would drift from the contract.
  const event = parseEvent({
    data: Buffer.from(JSON.stringify(parsed)).toString('base64'),
    messageId: 'broker',
  });
  if (!event) {
    logger.warn({ raw: parsed }, 'inventory-worker: broker message did not match schema; acking');
    return;
  }

  await handle(event, logger);
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  handleRequest(req, res).catch((err: unknown) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error({ err: errMsg }, 'inventory-worker: unhandled request error');
    if (!res.writableEnded) res.writeHead(500).end('internal error');
  });
});

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'inventory-worker listening');
});

void startConsumer({
  durable: 'inventory-worker',
  events: ['inventory.source.sync_started'],
  handle: handleFromBroker,
  logger,
})
  .then((consumer) => {
    if (!consumer) return;
    // Drain on shutdown so in-flight handlers finish and their acks land before
    // the process goes away.
    const drain = (): void => void consumer.stop();
    process.once('SIGTERM', drain);
    process.once('SIGINT', drain);
  })
  .catch((err: unknown) => {
    // A worker that cannot subscribe must not stay up looking healthy while
    // consuming nothing.
    logger.fatal({ err }, 'inventory-worker: broker subscription failed');
    process.exit(1);
  });

process.on('SIGTERM', () => {
  logger.info('inventory-worker: SIGTERM received, draining');
  server.close(() => {
    logger.info('inventory-worker: shut down cleanly');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 25_000).unref();
});
