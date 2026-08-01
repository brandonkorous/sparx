// Cloud Run entrypoint. Pub/Sub pushes media.uploaded events to POST /;
// we decode the OIDC token's `email` claim, dispatch to processAsset(),
// and respond 204 (ack) / 5xx (nack-and-retry).
//
// Cloud Run's frontend cryptographically verifies the OIDC token signature
// before the request reaches this process; we only need to confirm the
// `email` claim matches the expected invoker SA. That catches IAM
// misconfigurations where additional SAs end up with run.invoker on this
// service.
//
// Concurrency: Cloud Run's containerConcurrency (TF-managed) replaces the
// old MAX_CONCURRENT knob. sharp is CPU-heavy, so we keep concurrency=2
// per instance to match the original tuning; Cloud Run scales horizontally
// when more load arrives.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import pino from 'pino';
import { env } from './env.js';
import { processAsset } from './processor.js';
import { startConsumer } from '@sparx/events';

interface MediaUploadedEvent {
  type: 'media.uploaded';
  tenantId: string;
  occurredAt: string;
  data: {
    assetId: string;
    key: string;
    mimeType: string;
    byteSize: string;
    // Set to 'recrop' when the event is a focal-point / attach-time request to
    // refresh JUST the social aspect crops of an already-processed asset (docs/133
    // §8). Absent on a genuine upload — those run the full base transcode + crop pass.
    reason?: 'recrop';
  };
}

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

function parseEvent(raw: unknown): MediaUploadedEvent | null {
  const event = raw as Partial<MediaUploadedEvent> | undefined;
  if (event?.type !== 'media.uploaded') return null;
  if (!event.data?.assetId) return null;
  // tenantId is required — the transcode load runs inside its RLS context.
  if (!event.tenantId) return null;
  return event as MediaUploadedEvent;
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
    logger.warn({ messageId }, 'message did not match media.uploaded schema; acking');
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const result = await processAsset(event.data.assetId, event.tenantId, logger, {
      cropsOnly: event.data.reason === 'recrop',
    });
    logger.info({ messageId, assetId: event.data.assetId, ...result }, 'message processed');
    // processAsset records 'failed' to the MediaAsset row internally; ack
    // regardless so the message doesn't recycle forever. Manual re-enqueue
    // is the recovery path for failed assets.
    res.statusCode = 204;
    res.end();
  } catch (err) {
    logger.error({ err, messageId, assetId: event.data.assetId }, 'unhandled processor error');
    // processor.ts catches its own errors; if we got here, it's something
    // unexpected. 5xx triggers Pub/Sub redelivery.
    res.statusCode = 500;
    res.end();
  }
}

function main(): void {
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
    logger.info({ port: env.PORT }, 'media-worker listening for Pub/Sub pushes');
  });

  function shutdown(signal: NodeJS.Signals): void {
    logger.info({ signal }, 'shutdown received; draining');
    server.close(() => {
      logger.info('server closed; exiting');
      process.exit(0);
    });
    // Cloud Run grace period is 10s by default. Force exit if an in-flight
    // libvips encode hasn't returned.
    setTimeout(() => process.exit(1), 9_000).unref();
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

try {
  main();
} catch (err) {
  logger.fatal({ err }, 'media-worker failed to start');
  process.exit(1);
}

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
    logger.error({ err }, 'media-worker: broker message not valid JSON; acking');
    return;
  }

  const event = parseEvent(parsed);
  if (!event) {
    // Off-schema is permanent — ack rather than burn the retry budget.
    logger.warn({ raw: parsed }, 'media-worker: broker message did not match schema; acking');
    return;
  }

  // processAsset records 'failed' onto the MediaAsset row itself and returns
  // normally, so a genuine transcode failure ACKS rather than looping forever —
  // manual re-enqueue is the recovery path, unchanged from the HTTP behaviour.
  // Only an unexpected throw reaches startConsumer and triggers redelivery.
  const result = await processAsset(event.data.assetId, event.tenantId, logger, {
    cropsOnly: event.data.reason === 'recrop',
  });
  logger.info({ assetId: event.data.assetId, ...result }, 'message processed (broker)');
}

void startConsumer({
  durable: 'media-worker',
  events: ['media.uploaded'],
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
    logger.fatal({ err }, 'media-worker: broker subscription failed');
    process.exit(1);
  });
