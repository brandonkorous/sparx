// Scoring evaluator (docs/144 §10) — keeps scores current as things happen.
//
// The plan called for scoring to ride inside the segment evaluator, on the
// grounds that it already re-runs on exactly the events that should move a score.
// The topic set is right; the file is not. A segment evaluator that also scored
// would be two independent jobs sharing a transaction, so a scoring bug would
// roll back a membership change and a membership bug would leave scores stale —
// and neither failure would be findable from the name of the file it happened in.
// This subscribes to the SAME topics and adds the deal-side ones the segment
// evaluator has no reason to watch.
//
// SCORING IS SKIPPED ENTIRELY WHEN A TENANT HAS NO MODEL, which is every tenant
// until someone writes one. `scoreRecord` returns null and nothing is read or
// written — the consumer costs one indexed lookup per event, and a business that
// never asked for lead scoring never pays for it.

import { withTenant } from '@wizeworks/db';

import { gateHandler, type ConsumerContext } from './registry';
import type { PlatformEvent } from './platform-bus';
import { scoreRecord } from '../services/scoring-service';

interface EventPayload {
  customerId?: string;
  dealId?: string;
  orderId?: string;
}

/** Everything that can plausibly move a CONTACT's score. Mirrors the segment
 *  evaluator's list — the same events change the same projections — plus the
 *  engagement topics, which are most of what a lead score is made of. */
const CONTACT_TOPICS = [
  'order.created',
  'order.cancelled',
  'order.refunded',
  'crm.activity.recorded',
  // Kept identical to the segment evaluator's list, deliberately: these two
  // arrays are meant to mirror each other, and two lists that are supposed to
  // agree are exactly what went wrong in the bridge below them.
  'crm.customer.created',
  'crm.customer.updated',
  'crm.customer.subscribed',
  'email.opened',
  'email.clicked',
  'crm.engagement.received',
];

/** Everything that can move a DEAL's health score. A stage move is the big one:
 *  it changes `stageType`, resets `daysInStage`, and is the moment a rep most
 *  wants the board re-ordered. */
const DEAL_TOPICS = [
  'crm.deal.created',
  'crm.deal.updated',
  'crm.deal.stage_changed',
  'crm.deal.closed',
];

export function registerScoringConsumers(ctx: ConsumerContext): (() => void)[] {
  const teardowns: (() => void)[] = [];

  for (const topic of CONTACT_TOPICS) {
    teardowns.push(
      ctx.bus.subscribe(
        topic,
        gateHandler<unknown>(async (event) => {
          const customerId = await resolveCustomerId(event as PlatformEvent<EventPayload>);
          if (!customerId) return;
          await scoreOne(event.tenantId, 'contact', customerId);
        })
      )
    );
  }

  for (const topic of DEAL_TOPICS) {
    teardowns.push(
      ctx.bus.subscribe(
        topic,
        gateHandler<unknown>(async (event) => {
          const dealId = (event as PlatformEvent<EventPayload>).payload?.dealId;
          if (!dealId) return;
          await scoreOne(event.tenantId, 'deal', dealId);
          // A deal moving also changes its contact's `openDeals`, which is a
          // contact-scoring field. Skipping this is how a contact's score goes
          // stale the moment their opportunity closes — the exact moment it
          // matters most.
          const customerId = await dealCustomer(event.tenantId, dealId);
          if (customerId) await scoreOne(event.tenantId, 'contact', customerId);
        })
      )
    );
  }

  return teardowns;
}

/** Score one record. Swallows nothing: a scoring failure is logged by the bus's
 *  own handler wrapper, and must not take down the membership evaluator
 *  subscribed to the same topic. */
async function scoreOne(tenantId: string, objectKey: string, recordId: string): Promise<void> {
  await withTenant({ tenantId, userId: undefined }, (tx) =>
    scoreRecord(tx, tenantId, objectKey, recordId)
  );
}

async function dealCustomer(tenantId: string, dealId: string): Promise<string | null> {
  return withTenant({ tenantId, userId: undefined }, async (tx) => {
    const deal = await tx.deal.findUnique({ where: { id: dealId }, select: { customerId: true } });
    return deal?.customerId ?? null;
  });
}

/** Extract the customerId from an event payload, following an order reference
 *  when the event carries one instead. Same shape as the segment evaluator's
 *  resolver — the payloads are the same payloads. */
async function resolveCustomerId(event: PlatformEvent<EventPayload>): Promise<string | null> {
  if (event.payload?.customerId) return event.payload.customerId;
  if (event.payload?.orderId) {
    return withTenant({ tenantId: event.tenantId, userId: undefined }, async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: event.payload.orderId },
        select: { customerId: true },
      });
      return order?.customerId ?? null;
    });
  }
  return null;
}
