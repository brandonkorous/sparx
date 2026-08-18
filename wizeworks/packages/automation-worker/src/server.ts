// HTTP surface for the automation-worker (docs/81 §7, docs/84 Slice D).
//
// Two trigger surfaces on one Cloud Run service:
//
//   POST /internal/cron/tick   Cloud Scheduler (every minute). Guarded by the
//                              SPARX_INTERNAL_CRON_TOKEN header. Drives one
//                              schedule tick + one run tick. This alone makes
//                              scheduled system automations live — no event
//                              fan-in required (that's Slice E).
//
//   POST /internal/cron/reconcile-seeds
//                              Cloud Scheduler (daily). Same auth as the tick.
//                              Back-fills system automations for tenants whose
//                              owning module is already active (docs/84 Slice F2
//                              backfill) — Slice E seeds only forward, so this
//                              covers pre-existing tenants + dropped events.
//
//   POST /                     Pub/Sub push on `automation.trigger`. Guarded by
//                              the OIDC `email` claim == PUBSUB_INVOKER_SA. Decodes
//                              the SparxEvent envelope → handleTrigger. The
//                              subscription is provisioned in Slice E; the handler
//                              is wired now so the service is push-ready on day one.
//
//   GET  /healthz              Liveness/readiness (200).
//
// Pub/Sub push semantics: 2xx (204) = ack, 4xx = permanent drop, 5xx/timeout =
// redeliver. The advisory lock inside runAutomationTick makes concurrent ticks
// (overlapping scheduler fires, multiple instances) a safe no-op for losers.
//
// No side effects on import — `index.ts` constructs the server and listens. This
// keeps the module drivable by the integration suite on an ephemeral port.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import pino from 'pino';
import { z } from 'zod';
import { env } from './env.js';
import { ingest, reconcileSeeds, runTick } from './runtime.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

interface PubSubPushEnvelope {
  message?: {
    data?: string;
    attributes?: Record<string, string>;
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
}

// The wire shape of a bus event = the engine's TriggerEnvelope. `data` is opaque
// to the worker (the entity resolver hydrates it downstream).
const TriggerEnvelopeSchema = z.object({
  type: z.string().min(1),
  tenantId: z.string().min(1),
  actorId: z.string().nullable(),
  occurredAt: z.string().min(1),
  data: z.unknown(),
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

// The tick endpoint accepts EITHER the internal cron token (local/manual) OR a
// Cloud Scheduler OIDC caller whose `email` claim matches TICK_INVOKER_SA (prod
// — keeps the shared secret out of the scheduler-job config). With neither
// configured, every caller is rejected.
function tickAuthorized(req: IncomingMessage): boolean {
  const token = req.headers['x-sparx-internal-cron-token'];
  if (env.SPARX_INTERNAL_CRON_TOKEN && token === env.SPARX_INTERNAL_CRON_TOKEN) return true;
  if (env.TICK_INVOKER_SA && decodeOidcEmail(req.headers.authorization) === env.TICK_INVOKER_SA) {
    return true;
  }
  return false;
}

// ── POST /internal/cron/tick (driven by the automation-tick CronJob) ────────
// Exported so wizeworks/services/event-worker can mount it on the one HTTP server that
// process runs, rather than delegating to `handleRequest` and inheriting its
// `/` Pub/Sub push route — which has no sender left now the broker is NATS.
export async function handleTickRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!tickAuthorized(req)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }
  const summary = await runTick(logger);
  logger.info(summary, 'tick complete');
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(summary));
}

// ── POST /internal/cron/reconcile-seeds (daily CronJob) ─────────────────────
export async function handleReconcileRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (!tickAuthorized(req)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }
  const summary = await reconcileSeeds(logger);
  logger.info(summary, 'reconcile-seeds complete');
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(summary));
}

/** Broker intake for `automation.trigger` — the path used in-cluster.
 *
 *  Shares TriggerEnvelopeSchema and `ingest` with the HTTP push handler below,
 *  so the two intakes can never drift on what counts as a valid trigger. Only
 *  the ack semantics differ: push says "acked" with a 204 and "redeliver" with a
 *  500, whereas here RETURNING acks and THROWING nak-s.
 *
 *  Unparseable input returns rather than throws. A message that cannot be parsed
 *  will not parse on redelivery either, so throwing would just burn the retry
 *  budget before dead-lettering it — the same call the other workers make.
 */
export async function ingestFromBroker(raw: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    logger.error({ err }, 'automation-worker: broker message not valid JSON; acking');
    return;
  }

  const result = TriggerEnvelopeSchema.safeParse(parsed);
  if (!result.success) {
    logger.warn({ raw: parsed }, 'automation-worker: not a trigger envelope; acking');
    return;
  }

  // Throwing here is deliberate: startConsumer nak-s so the broker redelivers.
  await ingest(result.data, logger);
  logger.info({ type: result.data.type }, 'trigger ingested');
}

// ── POST / (Pub/Sub push on automation.trigger) ─────────────────────────────
async function handlePush(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
    // Malformed envelope is permanent — 400 stops Pub/Sub from retrying.
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

  const result = TriggerEnvelopeSchema.safeParse(parsed);
  if (!result.success) {
    logger.warn({ messageId, raw: parsed }, 'message is not a trigger envelope; acking');
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    // The zod schema's inferred shape IS the TriggerEnvelope contract; data stays opaque.
    await ingest(result.data, logger);
    logger.info({ messageId, type: result.data.type }, 'trigger ingested');
    res.statusCode = 204;
    res.end();
  } catch (err) {
    // Transient (DB blip, Pub/Sub down) — 500 so Pub/Sub redelivers.
    logger.error({ err, messageId }, 'ingest failed — returning 500 for redelivery');
    res.statusCode = 500;
    res.end();
  }
}

export async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = req.url ?? '/';

  if (req.method === 'GET' && (url === '/healthz' || url === '/')) {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', service: 'automation-worker' }));
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end();
    return;
  }

  if (url === '/internal/cron/tick') {
    await handleTickRequest(req, res);
    return;
  }

  if (url === '/internal/cron/reconcile-seeds') {
    await handleReconcileRequest(req, res);
    return;
  }

  // Default path is the Pub/Sub push target.
  if (url === '/' || url === '/pubsub') {
    await handlePush(req, res);
    return;
  }

  res.statusCode = 404;
  res.end();
}

export function createWorkerServer(): Server {
  return createServer((req, res) => {
    handleRequest(req, res).catch((err: unknown) => {
      logger.error({ err }, 'unhandled request error');
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end();
      }
    });
  });
}
