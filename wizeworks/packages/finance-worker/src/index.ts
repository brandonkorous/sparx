// finance-worker — recurring generation + the daily profit rollup (docs/148 §8).
//
// A LIBRARY, registered by services/event-worker. Not a service, not a Dockerfile,
// not a Deployment: twelve separate worker Deployments were an inheritance from
// Cloud Run that cost 37% of a node's memory to do 14 millicores of work
// (services/CLAUDE.md). `DURABLE` is the JetStream cursor key and is permanent
// once shipped — changing it replays or skips the stream.

import type { Logger } from 'pino';
import { createBrokerHandler, type WorkerSubscription } from '@wizeworks/events';

import { handle, parseEvent } from './handler.js';

export const DURABLE = 'finance-worker';
export const EVENTS = [
  'finance.expense.recorded',
  'finance.expense.allocated',
  'finance.recurring.due',
  'finance.profit.recompute',
  // Seeds the expense categories when Finance becomes available — including the
  // bundled case, where turning on Commerce or B2B announces `finance` with no
  // finance flag of its own. Nothing listened for this, so no tenant had the
  // `wages` category and the staff labour deriver refused every run.
  //
  // ADDING a subject to a shipped durable is safe: `consumers.add` upserts, so
  // this updates `finance-worker` in place rather than minting a new cursor.
  // With `DeliverPolicy.All` the widened filter then replays whatever
  // `module.activated` is still inside the stream's retention window — a free
  // partial backfill, harmless because the seed is create-only. It does NOT
  // reach tenants whose activation has aged out; those are the ops task
  // `backfill-finance-categories`.
  'module.activated',
];

export function createSubscription(logger: Logger): WorkerSubscription {
  return {
    durable: DURABLE,
    events: EVENTS,
    handle: createBrokerHandler({ name: DURABLE, logger, parseEvent, handle }),
  };
}

export { handle, parseEvent, type FinanceEvent, type FinanceHandlerOutcome } from './handler.js';
