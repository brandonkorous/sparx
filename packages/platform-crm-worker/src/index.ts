// platform-crm-worker — tenant + module lifecycle into the platform's own CRM.
//
// A library, registered by services/event-worker. See legal-seed-worker/src for
// the note on why these are no longer separate containers; `DURABLE` is the
// JetStream cursor key and must not change.

import type { Logger } from 'pino';
import { createBrokerHandler, type WorkerSubscription } from '@sparx/events';

import { handle, parseEvent } from './handler.js';

export const DURABLE = 'platform-crm-worker';
export const EVENTS = [
  'tenant.created',
  'tenant.updated',
  'tenant.subscription.changed',
  'module.activated',
  'module.deactivated',
];

export function createSubscription(logger: Logger): WorkerSubscription {
  return {
    durable: DURABLE,
    events: EVENTS,
    handle: createBrokerHandler({ name: DURABLE, logger, parseEvent, handle }),
  };
}
