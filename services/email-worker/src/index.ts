// Cloud Run entrypoint. Pub/Sub pushes to POST / — we decode the OIDC
// token's `email` claim, dispatch the message to handle(), and respond
// 204 (ack) / 5xx (nack-and-retry).
//
// Cloud Run's frontend cryptographically verifies the OIDC token signature
// before the request reaches this process; we only need to confirm the
// `email` claim matches the expected invoker SA. That catches IAM
// misconfigurations where additional SAs end up with run.invoker on this
// service.
//
// Pub/Sub push semantics:
//   - 2xx (we use 204)            → ack, no retry
//   - 4xx                         → permanent reject, no retry
//   - 5xx / no response / timeout → redelivered up to max_delivery_attempts
//
// Provider selection (console vs Postal), default From, and Postal
// credentials are owned by @sparx/email's getEmailProvider() — set
// SPARX_EMAIL_PROVIDER / SPARX_POSTAL_URL / SPARX_POSTAL_API_KEY in the
// Cloud Run service env.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import pino from 'pino';
import { getEmailProvider } from '@sparx/email';
import { env } from './env.js';
import { startConsumer } from '@sparx/events';
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
    // Malformed envelope is permanent — 400 stops Pub/Sub from retrying.
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
    logger.warn({ messageId, raw: parsed }, 'message did not match email.send schema; acking');
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const outcome = await handle(event, logger);
    logger.info(
      {
        messageId,
        template: 'kind' in event.data ? 'raw' : event.data.template,
        outcome: outcome.status,
        providerMessageId: outcome.messageId,
      },
      'message processed'
    );
    res.statusCode = 204;
    res.end();
  } catch (err) {
    logger.error(
      { err, messageId },
      'transient send failure — returning 500 to trigger redelivery'
    );
    res.statusCode = 500;
    res.end();
  }
}

/**
 * Broker path. Decodes the raw JetStream payload and runs the SAME `handle()`
 * the HTTP push path above runs — one implementation of what an `email.send`
 * DOES, two ways of delivering it to that implementation.
 *
 * Throwing is meaningful here: `startConsumer` nak-s the message so the broker
 * redelivers it. That is the difference this whole change is about — under the
 * fire-and-forget HTTP transport, a send that failed while the worker was
 * rolling was simply lost, and the publisher reported success.
 *
 * A malformed or off-schema payload is NOT thrown on, for the same reason the
 * HTTP path acks it with a 204: redelivering something that can never parse
 * just burns the retry budget and then dead-letters. Only a transient failure
 * — the provider being down, a timeout — deserves a retry.
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
    logger.warn({ raw: parsed }, 'broker message did not match email.send schema; acking');
    return;
  }

  const outcome = await handle(event, logger);
  logger.info(
    {
      template: 'kind' in event.data ? 'raw' : event.data.template,
      outcome: outcome.status,
      providerMessageId: outcome.messageId,
    },
    'message processed (broker)'
  );
}

async function main(): Promise<void> {
  // Touch the provider at boot so a misconfig (e.g. SPARX_EMAIL_PROVIDER=
  // postal but no API key) crashes the instance immediately instead of
  // failing the first message at 3am.
  const provider = getEmailProvider();
  logger.info({ provider: provider.name }, 'email provider selected');

  // Subscribe to the broker. Returns null when EVENT_BROKER is not `nats`, in
  // which case the HTTP server below is the only delivery path — which is what
  // local dev and a Pub/Sub push deployment both want.
  const consumer = await startConsumer({
    durable: 'email-worker',
    events: ['email.send'],
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
    logger.info({ port: env.PORT }, 'email-worker listening for Pub/Sub pushes');
  });

  function shutdown(signal: NodeJS.Signals): void {
    logger.info({ signal }, 'shutdown received; draining');
    // Drain the broker subscription FIRST so in-flight handlers finish and
    // their acks land before the process goes away. Without this a rolling
    // restart leaves messages unacknowledged mid-send — they are redelivered
    // rather than lost, but a redelivered `email.send` is a duplicate email.
    void consumer?.stop();
    server.close(() => {
      logger.info('server closed; exiting');
      process.exit(0);
    });
    // Cloud Run grace period is 10s by default (configurable via TF). Force
    // exit if a hung request hasn't drained by then.
    setTimeout(() => process.exit(1), 9_000).unref();
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// main() is async now (it awaits the broker subscription), so a try/catch
// around the call would only catch a SYNCHRONOUS throw and let a failed
// broker connection become an unhandled rejection — a worker that logs
// nothing and stays up consuming nothing.
main().catch((err: unknown) => {
  logger.fatal({ err }, 'email-worker failed to start');
  process.exit(1);
});
