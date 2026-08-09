// social-worker — scheduled posts, metrics collection, inbox sync.
//
// A library, registered by services/event-worker. See legal-seed-worker/src for
// the note on why these are no longer separate containers; `DURABLE` is the
// JetStream cursor key and must not change.

import type { Logger } from 'pino';
import { createBrokerHandler, type WorkerSubscription } from '@sparx/events';

import { handle, parseEvent } from './handler.js';

export const DURABLE = 'social-worker';
export const EVENTS = [
  'social.post.due',
  'social.metrics.collect',
  'social.connection.check',
  'social.inbox.sync',
  'social.inbox.reply',
];

export function createSubscription(logger: Logger): WorkerSubscription {
  return {
    durable: DURABLE,
    events: EVENTS,
    handle: createBrokerHandler({ name: DURABLE, logger, parseEvent, handle }),
  };
}
