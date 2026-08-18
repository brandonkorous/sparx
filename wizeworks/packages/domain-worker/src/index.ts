// domain-worker — `domain.purchased`, plus the domain renewal check.
//
// A library, registered by services/event-worker. See legal-seed-worker/src for
// the note on why these are no longer separate containers; `DURABLE` is the
// JetStream cursor key and must not change.

import type { Logger } from 'pino';
import { createBrokerHandler, type WorkerSubscription } from '@wizeworks/events';

import { parseDomainPurchasedEvent, handleDomainPurchased } from './handler.js';

export { runRenewalCheck } from './cron.js';

export const DURABLE = 'domain-worker';
export const EVENTS = ['domain.purchased'];

export function createSubscription(logger: Logger): WorkerSubscription {
  return {
    durable: DURABLE,
    events: EVENTS,
    handle: createBrokerHandler({
      name: DURABLE,
      logger,
      parseEvent: parseDomainPurchasedEvent,
      handle: handleDomainPurchased,
    }),
  };
}
