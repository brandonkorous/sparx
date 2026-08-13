// event-worker — the one process that runs the event handlers.
//
// ─── Why this exists ────────────────────────────────────────────────────────
//
// There were fourteen worker Deployments. Twelve of them are now handlers in
// here; media-worker and import-worker stayed separate on purpose (below).
//
// The split was never a design — it was inherited. On Cloud Run each worker HAD
// to be its own service: a container behind a Pub/Sub push subscription, scaled
// to zero, billed per request. Fourteen idle services and one idle service cost
// the same there, so splitting was free and the boundaries were drawn wherever
// was convenient. Moving to a fixed 8 GiB node changed the arithmetic and
// nothing was re-drawn: fourteen idle Node runtimes at ~153 MiB of baseline heap
// each held 2.15 GiB — 37% of the node — to do 14 millicores of work between
// them. On 2026-08-08 the node ran out of memory, evicted api-rest, and the
// platform served 502s for twelve hours.
//
// What the split was supposed to buy, measured rather than assumed:
//
//   • Independent scaling — never used. All fourteen were `replicas: 1`.
//   • Independent deploy — not a thing here. The release builds every image on
//     one SHA and rolls them together, deliberately.
//   • Distinct runtime — true of media-worker alone (it mounts the media PVC).
//   • Failure isolation — the one real benefit, and narrower than it looks.
//     JetStream already isolates per MESSAGE: a throw naks and redelivers that
//     message only. Process isolation buys the crash-or-leak case.
//
// So the trade this makes is explicit: twelve-way process isolation becomes
// three-way, and a handler that hard-crashes or leaks now takes its neighbours
// with it. media-worker (sharp, image buffers, a PVC) and import-worker (bulk
// file parsing) are exactly the two most likely to do that, which is why they
// are the two that stayed out.
//
// ─── What is NOT changing ───────────────────────────────────────────────────
//
// Every handler keeps its own `durable` name and its own event list. A durable
// is JetStream's cursor key, so twelve consumers still exist server-side, each
// resuming exactly where its pod left off. Merging them into one durable would
// have replayed or skipped the stream depending on its deliver policy — the
// consolidation is of PROCESSES, not of subscriptions.
//
// That also means twelve `startConsumer` calls and twelve NATS connections from
// this pod. Deliberate: a shared connection would have meant reworking ack and
// nak handling for a saving NATS does not need. Connections are cheap; the Node
// heaps were not.

// MUST BE FIRST: raises DATABASE_URL's connection_limit before `@sparx/db` is
// constructed (it reads the pool size at import). Twelve handlers now share one
// pool — see boot-db-pool.ts for why the floor moved from 5 to 20.
import './boot-db-pool.js';

import pino from 'pino';
import { startConsumer, type RunningConsumer, type WorkerSubscription } from '@sparx/events';

import * as automation from '@sparx/automation-worker';
import * as channelSync from '@sparx/channel-sync-worker';
import * as commerceIndexer from '@sparx/commerce-indexer';
import * as domain from '@sparx/domain-worker';
import * as dropship from '@sparx/dropship-worker';
import * as email from '@sparx/email-worker';
import * as finance from '@sparx/finance-worker';
import * as inventory from '@sparx/inventory-worker';
import * as legalSeed from '@sparx/legal-seed-worker';
import * as markupRecompute from '@sparx/markup-recompute-worker';
import * as platformCrm from '@sparx/platform-crm-worker';
import * as push from '@sparx/push-worker';
import * as social from '@sparx/social-worker';
import * as staff from '@sparx/staff-worker';

import { env } from './env.js';
import { createHttpServer, PORT } from './http.js';

const logger = pino({
  level: env.LOG_LEVEL,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

/**
 * Every handler gets a child logger tagged with its worker name, so a merged
 * process still produces log lines you can filter by worker exactly the way the
 * separate Deployments did.
 */
function forWorker(name: string): pino.Logger {
  return logger.child({ worker: name });
}

const SUBSCRIPTIONS: WorkerSubscription[] = [
  automation.createSubscription(),
  channelSync.createSubscription(forWorker(channelSync.DURABLE)),
  commerceIndexer.createSubscription(forWorker(commerceIndexer.DURABLE)),
  domain.createSubscription(forWorker(domain.DURABLE)),
  dropship.createSubscription(forWorker(dropship.DURABLE)),
  email.createSubscription(forWorker(email.DURABLE)),
  finance.createSubscription(forWorker(finance.DURABLE)),
  inventory.createSubscription(forWorker(inventory.DURABLE)),
  legalSeed.createSubscription(forWorker(legalSeed.DURABLE)),
  markupRecompute.createSubscription(forWorker(markupRecompute.DURABLE)),
  platformCrm.createSubscription(forWorker(platformCrm.DURABLE)),
  push.createSubscription(forWorker(push.DURABLE)),
  social.createSubscription(forWorker(social.DURABLE)),
  staff.createSubscription(forWorker(staff.DURABLE)),
];

const consumers: RunningConsumer[] = [];

async function main(): Promise<void> {
  // Boot work that must happen before messages arrive. Only commerce-indexer
  // has any; it creates the Typesense collections it writes into and is
  // written not to throw, so a search outage cannot stop email from sending.
  await commerceIndexer.boot(forWorker(commerceIndexer.DURABLE));

  const server = createHttpServer(logger);
  server.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT, handlers: SUBSCRIPTIONS.length }, 'event-worker listening');
  });

  // Subscribe to all twelve before reporting ready. A partial subscription is
  // the failure this whole fleet has already had once: a pod that boots, passes
  // its health check, and quietly consumes nothing while events pile up. If any
  // one fails to subscribe, the process dies and Kubernetes restarts it rather
  // than leaving it up looking healthy.
  const started = await Promise.all(
    SUBSCRIPTIONS.map(async (sub) => {
      try {
        const consumer = await startConsumer({
          durable: sub.durable,
          events: sub.events,
          handle: sub.handle,
          logger: forWorker(sub.durable),
        });
        logger.info(
          { durable: sub.durable, events: sub.events.length, broker: consumer !== null },
          'subscribed'
        );
        return consumer;
      } catch (err) {
        logger.fatal({ err, durable: sub.durable }, 'broker subscription failed');
        throw err;
      }
    })
  );

  // `startConsumer` returns null when the transport is not a broker — the local
  // `log` transport, where there is nothing to drain.
  consumers.push(...started.filter((c): c is RunningConsumer => c !== null));

  function shutdown(signal: NodeJS.Signals): void {
    logger.info({ signal, consumers: consumers.length }, 'shutdown received; draining');
    // Drain every consumer so in-flight handlers finish and their acks land. An
    // unacknowledged message is redelivered rather than lost, but a redelivered
    // side effect is a duplicate one.
    void Promise.allSettled(consumers.map((c) => c.stop())).then(() => {
      server.close(() => {
        logger.info('drained; exiting');
        process.exit(0);
      });
    });
    // Twelve consumers to drain rather than one, so the hard deadline sits just
    // inside the pod's default 30s grace period instead of automation-worker's
    // old 9s.
    setTimeout(() => process.exit(1), 25_000).unref();
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err: unknown) => {
  logger.fatal({ err }, 'event-worker failed to start');
  process.exit(1);
});
