// B2B overdue-worker entrypoint.
//
// Routes:
//   POST /internal/cron/overdue-check  — Cloud Scheduler trigger (daily)
//
// No Pub/Sub push subscription needed — this worker is triggered only
// by Cloud Scheduler (daily cron). The SPARX_INTERNAL_CRON_TOKEN header
// guards the endpoint against unauthenticated invocations.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import pino from 'pino';
import { env } from './env.js';
import { runOverdueCheck } from './cron.js';

const logger = pino({
  level: env.LOG_LEVEL,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end();
    return;
  }

  const url = req.url ?? '/';

  if (url === '/internal/cron/overdue-check') {
    const token = req.headers['x-sparx-internal-cron-token'];
    if (!env.SPARX_INTERNAL_CRON_TOKEN || token !== env.SPARX_INTERNAL_CRON_TOKEN) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }
    try {
      const result = await runOverdueCheck(logger);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    } catch (err) {
      logger.error({ err }, 'overdue check failed');
      res.statusCode = 500;
      res.end('Internal error');
    }
    return;
  }

  res.statusCode = 404;
  res.end();
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((err: unknown) => {
    logger.error({ err }, 'unhandled request error');
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end();
    }
  });
});

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'b2b-overdue-worker listening');
});
