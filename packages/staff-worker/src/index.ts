// staff-worker — approved hours become a wage expense (docs/149 §4).
//
// A LIBRARY, registered by services/event-worker. Not a service, not a
// Dockerfile, not a Deployment: twelve separate worker Deployments were an
// inheritance from Cloud Run that cost 37% of a node's memory to do 14
// millicores of work (services/CLAUDE.md). `DURABLE` is the JetStream cursor key
// and is permanent once shipped — changing it replays or skips the stream.
//
// It subscribes to ONE event on purpose. `staff.time.approved` is the trigger
// docs/149 names, and approval is a deliberate act precisely so a mistyped shift
// cannot move the month's profit before anyone has looked at it. The other
// `staff.*` events are topic-only: their notification fan-out rides the
// publish() tee, and the certification sweep is an api-rest tick.

import type { Logger } from 'pino';
import { createBrokerHandler, type WorkerSubscription } from '@sparx/events';

import { handle, parseEvent } from './handler.js';

export const DURABLE = 'staff-worker';
export const EVENTS = ['staff.time.approved'];

export function createSubscription(logger: Logger): WorkerSubscription {
  return {
    durable: DURABLE,
    events: EVENTS,
    handle: createBrokerHandler({ name: DURABLE, logger, parseEvent, handle }),
  };
}

export { handle, parseEvent, type StaffEvent, type StaffHandlerOutcome } from './handler.js';
