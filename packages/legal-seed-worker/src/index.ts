// legal-seed-worker — `tenant.created`.
//
// This is a LIBRARY, not a service. It used to be its own container, its own
// Deployment and its own ~150 MiB Node runtime to handle exactly one event
// type; it is now one subscription among twelve registered by
// services/event-worker. See that file for why the split was undone.
//
// `DURABLE` is JetStream's cursor key and must not change — it is the same
// string the standalone worker used, so the consumer carries on from where it
// stopped rather than replaying the stream.

import type { Logger } from 'pino';
import { createBrokerHandler, type WorkerSubscription } from '@sparx/events';

import { handle, parseEvent } from './handler.js';

export const DURABLE = 'legal-seed-worker';
export const EVENTS = ['tenant.created'];

export function createSubscription(logger: Logger): WorkerSubscription {
  return {
    durable: DURABLE,
    events: EVENTS,
    handle: createBrokerHandler({ name: DURABLE, logger, parseEvent, handle }),
  };
}
