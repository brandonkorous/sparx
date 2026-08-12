// finance-worker — recurring generation + the daily profit rollup (docs/148 §8).
//
// A LIBRARY, registered by services/event-worker. Not a service, not a Dockerfile,
// not a Deployment: twelve separate worker Deployments were an inheritance from
// Cloud Run that cost 37% of a node's memory to do 14 millicores of work
// (services/CLAUDE.md). `DURABLE` is the JetStream cursor key and is permanent
// once shipped — changing it replays or skips the stream.

import type { Logger } from 'pino';
import { createBrokerHandler, type WorkerSubscription } from '@sparx/events';

import { handle, parseEvent } from './handler.js';

export const DURABLE = 'finance-worker';
export const EVENTS = [
  'finance.expense.recorded',
  'finance.expense.allocated',
  'finance.recurring.due',
  'finance.profit.recompute',
];

export function createSubscription(logger: Logger): WorkerSubscription {
  return {
    durable: DURABLE,
    events: EVENTS,
    handle: createBrokerHandler({ name: DURABLE, logger, parseEvent, handle }),
  };
}

export { handle, parseEvent, type FinanceEvent, type FinanceHandlerOutcome } from './handler.js';
