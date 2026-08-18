// channel-sync-worker — pushes catalog + inventory changes out to sales channels.
//
// A library, registered by services/event-worker. See legal-seed-worker/src for
// the note on why these are no longer separate containers; `DURABLE` is the
// JetStream cursor key and must not change.

import type { Logger } from 'pino';
import { createBrokerHandler, type WorkerSubscription } from '@wizeworks/events';

import { handle, parseEvent } from './handler.js';

export const DURABLE = 'channel-sync-worker';
export const EVENTS = [
  'product.created',
  'product.updated',
  'product.deleted',
  'inventory.adjusted',
  'order.fulfilled',
];

export function createSubscription(logger: Logger): WorkerSubscription {
  return {
    durable: DURABLE,
    events: EVENTS,
    handle: createBrokerHandler({ name: DURABLE, logger, parseEvent, handle }),
  };
}
