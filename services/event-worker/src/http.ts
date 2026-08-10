// The one HTTP listener.
//
// Twelve workers each ran a `node:http` server; eleven of them served nothing
// anybody called. They existed because on Cloud Run an HTTP server IS the
// delivery mechanism — Pub/Sub pushed events to POST / and the OIDC `email`
// claim was the authentication. In-cluster the broker delivers over NATS, and
// `SPARX_DEV_WORKER_ROUTES` (the publisher-side HTTP fan-out) has been removed,
// so nothing POSTs to a worker any more. Those servers, their push envelopes
// and their token decoding are gone with the consolidation.
//
// What genuinely needs a socket, and why each one survives:
//
//   • GET /healthz — the readiness/liveness probe.
//   • POST /internal/cron/tick and /internal/cron/reconcile-seeds — driven by
//     the `automation-tick` (every minute) and `automation-reconcile-seeds`
//     (daily) CronJobs. Real callers, in-cluster, today.
//   • POST /internal/cron/renewal-check — the domain renewal sweep, driven by
//     the `domain-renewal-check` CronJob (daily, 04:20 UTC). It was carried over
//     here with nothing scheduling it at all: the Cloud Scheduler job its
//     docblock names was never actually created on either cloud, so the route
//     answered and no purchased domain ever got an expiry warning. Keeping the
//     dead route rather than deleting it is what made it cheap to wire up; see
//     k8s/cronjobs/domain-renewal-check.yaml for why the schedule must stay
//     daily.
//
// Probes are tcpSocket in the manifest, so /healthz is for humans and for any
// future httpGet probe — it must stay cheap and touch nothing.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Logger } from 'pino';

import { handleTickRequest, handleReconcileRequest } from '@sparx/automation-worker';
import { runRenewalCheck } from '@sparx/domain-worker';
import { env } from './env.js';

async function route(req: IncomingMessage, res: ServerResponse, logger: Logger): Promise<void> {
  const url = req.url ?? '/';

  if (req.method === 'GET' && (url === '/healthz' || url === '/')) {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', service: 'event-worker' }));
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end();
    return;
  }

  // Both automation routes do their own authorization (a shared cron token, or
  // an OIDC invoker claim) — see packages/automation-worker/src/server.ts.
  if (url === '/internal/cron/tick') {
    await handleTickRequest(req, res);
    return;
  }

  if (url === '/internal/cron/reconcile-seeds') {
    await handleReconcileRequest(req, res);
    return;
  }

  if (url === '/internal/cron/renewal-check') {
    await handleRenewalCheck(req, res, logger);
    return;
  }

  res.statusCode = 404;
  res.end();
}

/**
 * Moved verbatim from domain-worker's entrypoint, token guard included: an
 * unset `SPARX_INTERNAL_CRON_TOKEN` denies rather than allows, so a
 * misconfigured deployment cannot leave the sweep open to the cluster.
 */
async function handleRenewalCheck(
  req: IncomingMessage,
  res: ServerResponse,
  logger: Logger
): Promise<void> {
  const expected = process.env.SPARX_INTERNAL_CRON_TOKEN;
  if (!expected || req.headers['x-sparx-internal-cron-token'] !== expected) {
    res.statusCode = 403;
    res.end();
    return;
  }
  try {
    const result = await runRenewalCheck(logger);
    logger.info(result, 'renewal check complete');
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(result));
  } catch (err) {
    logger.error({ err }, 'renewal check failed');
    res.statusCode = 500;
    res.end();
  }
}

export function createHttpServer(logger: Logger): Server {
  return createServer((req, res) => {
    route(req, res, logger).catch((err: unknown) => {
      logger.error({ err, url: req.url }, 'unhandled request error');
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end();
      }
    });
  });
}

export const PORT = env.PORT;
