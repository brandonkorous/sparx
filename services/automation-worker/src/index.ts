// automation-worker entrypoint. Constructs the HTTP server (see server.ts for
// the route contract) and listens; the server logic itself is side-effect-free
// so the integration suite can drive it on an ephemeral port.

// MUST be first: raises DATABASE_URL's connection_limit before `@sparx/db`'s client
// is constructed (it reads the pool size at import). The tick pattern needs >= 2
// connections or every tick deadlocks with P2024 — see boot-db-pool.ts. Imported
// only here (the entrypoint), so the integration suite driving server.ts is unaffected.
import './boot-db-pool.js';

import { AUTOMATION_FANIN_TOPIC, startConsumer } from '@sparx/events';

import { env } from './env.js';
import { createWorkerServer, ingestFromBroker, logger } from './server.js';

const server = createWorkerServer();

server.listen(env.PORT, '0.0.0.0', () => {
  logger.info({ port: env.PORT }, 'automation-worker listening');
});

// Triggers arrive over the BROKER, not an HTTP push.
//
// This was the last worker still waiting to be POSTed to. On Cloud Run it was a
// Pub/Sub push target, so moving it to AKS meant nothing delivered to it at all:
// the pod would boot, pass its health check, and quietly ingest zero triggers
// while every automation in the database sat idle. The other eleven workers were
// converted to `startConsumer` when the broker interface landed; this one was
// missed because it is the only worker that ALSO serves HTTP, so it did not look
// like it was missing a subscription.
//
// The HTTP server stays — it still owns /internal/cron/tick and
// /internal/cron/reconcile-seeds, which are driven by CronJobs in-cluster rather
// than by Cloud Scheduler, plus /healthz for the probes. Only the event intake
// moved.
const consuming = startConsumer({
  durable: 'automation-worker',
  events: [AUTOMATION_FANIN_TOPIC],
  handle: ingestFromBroker,
  logger,
}).catch((err: unknown) => {
  // A worker that cannot subscribe must not stay up looking healthy while
  // consuming nothing — that is the exact failure this change removes.
  logger.fatal({ err }, 'automation-worker: broker subscription failed');
  process.exit(1);
});

function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, 'shutdown received; draining');
  // Drain the consumer first so in-flight handlers finish and their acks land;
  // an unacknowledged trigger is redelivered rather than lost, but a redelivered
  // side effect is a duplicate one.
  void consuming.then((consumer) => consumer?.stop());
  server.close(() => {
    logger.info('server closed; exiting');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 9_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
