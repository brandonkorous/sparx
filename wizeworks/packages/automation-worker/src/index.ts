// automation-worker — trigger ingest, plus the tick and reconcile-seeds cron
// routes that CronJobs drive in-cluster.
//
// A library, registered by services/event-worker. See legal-seed-worker/src for
// the note on why these are no longer separate containers; `DURABLE` is the
// JetStream cursor key and must not change.
//
// This is the one worker that also serves HTTP, so it exports `handleRequest`
// for the host process to mount rather than owning a server of its own. The
// `boot-db-pool` import that used to lead this file now lives in
// wizeworks/services/event-worker: the DB pool size is a property of the PROCESS, and the
// process is shared now — see the note there.

import { AUTOMATION_FANIN_TOPIC, type WorkerSubscription } from '@wizeworks/events';

import { ingestFromBroker } from './server.js';

export { handleTickRequest, handleReconcileRequest } from './server.js';

// The tick itself, for a host that drives its own heartbeat rather than waiting
// on a CronJob to POST at it. `handleTickRequest` above is the HTTP door onto the
// same function; outside Kubernetes there is nothing knocking on it (issue 354).
export { runTick, type TickSummary } from './runtime.js';

export const DURABLE = 'automation-worker';
export const EVENTS = [AUTOMATION_FANIN_TOPIC];

export function createSubscription(): WorkerSubscription {
  return {
    durable: DURABLE,
    events: EVENTS,
    // Already a raw-string handler — it fans one message out to many triggers,
    // so it does its own parsing and needs no `createBrokerHandler` wrapper.
    handle: ingestFromBroker,
  };
}
