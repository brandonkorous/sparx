// Cloud Run entrypoint — Pub/Sub push to POST /.
// Same OIDC check + dispatch pattern as email-worker and other Cloud Run workers.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import pino from 'pino';
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

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  handleRequest(req, res).catch((err: unknown) => {
    logger.error({ err }, 'dropship-worker: unhandled request error');
    if (!res.headersSent) res.writeHead(500).end('internal error');
  });
});

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'GET' && req.url === '/healthz') {
    res.writeHead(200).end('ok');
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405).end('method not allowed');
    return;
  }

  // Verify OIDC invoker SA when configured (defense in depth — Cloud Run
  // frontend already verified the signature).
  if (env.PUBSUB_INVOKER_SA) {
    const callerEmail = decodeOidcEmail(req.headers.authorization);
    if (callerEmail !== env.PUBSUB_INVOKER_SA) {
      logger.warn({ callerEmail }, 'dropship-worker: OIDC SA mismatch — rejecting');
      res.writeHead(403).end('forbidden');
      return;
    }
  }

  let body: string;
  try {
    body = await readBody(req);
  } catch (err) {
    logger.error({ err }, 'dropship-worker: failed to read body');
    res.writeHead(500).end('read error');
    return;
  }

  let envelope: PubSubPushEnvelope;
  try {
    envelope = JSON.parse(body) as PubSubPushEnvelope;
  } catch {
    logger.warn('dropship-worker: invalid JSON body — permanent reject');
    res.writeHead(400).end('bad request');
    return;
  }

  const event = parseEvent(envelope.message);
  if (!event) {
    logger.warn(
      { messageId: envelope.message.messageId },
      'dropship-worker: unparseable event — acking'
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
    eventLog.error(
      { err: err instanceof Error ? err.message : String(err) },
      'dropship-worker: handler threw — will retry'
    );
    res.writeHead(500).end('internal error');
  }
}

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'dropship-worker listening');
});

// Graceful shutdown — Cloud Run sends SIGTERM before terminating.
process.on('SIGTERM', () => {
  logger.info('dropship-worker: SIGTERM received, draining');
  server.close(() => {
    logger.info('dropship-worker: shut down cleanly');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 25_000).unref();
});
