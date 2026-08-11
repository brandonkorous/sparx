// Segment evaluator — the consumer that materializes `segment_members`
// incrementally as events flow.
//
// Locked decision #4: segments are materialized into a join table, never
// re-evaluated at email-send time. This consumer subscribes to every event
// that could plausibly change a customer's projection (orders, refunds,
// quote-acceptance, activity recording) and, for each affected customer,
// re-evaluates every active segment for the tenant, diffing membership.
//
// Topics watched:
//   • order.created / order.cancelled / order.refunded
//   • crm.activity.recorded (covers email opens/clicks via consumers)
//   • crm.customer.updated
//   • crm.customer.subscribed (storefront newsletter opt-in → marketing segment)
//   • crm.b2b.account_updated
//   • crm.segment.created / crm.segment.updated — the SEGMENT-driven pass, which
//     re-cuts one segment across every customer (the rest re-cut one customer
//     across every segment)
//
// Each addition emits crm.segment.entered + writes a CrmActivity row;
// each removal emits crm.segment.exited + writes its activity row.

import { withTenant } from '@sparx/db';
import { evaluateSegmentRule, SegmentRuleSchema, type SegmentRule } from '@sparx/crm-schemas';

import { publishCrmEvent } from '../events';
import { gateHandler, type ConsumerContext } from './registry';
import { buildSegmentRuleProjection } from './segment-projection';
import type { PlatformEvent } from './platform-bus';

interface EventPayload {
  customerId?: string;
  orderId?: string;
}

interface SegmentEventPayload {
  segmentId?: string;
  /** Only present on `crm.segment.updated`. Absent on create, where the rules
   *  are new by definition. */
  rulesChanged?: boolean;
}

export function registerSegmentEvaluatorConsumers(ctx: ConsumerContext): (() => void)[] {
  const teardowns: (() => void)[] = [];
  const topics = [
    'order.created',
    'order.cancelled',
    'order.refunded',
    'crm.activity.recorded',
    'crm.customer.updated',
    'crm.customer.subscribed',
    'crm.b2b.account_updated',
  ];

  for (const topic of topics) {
    teardowns.push(
      ctx.bus.subscribe(
        topic,
        gateHandler<unknown>(async (event) => {
          const customerId = await resolveCustomerId(event as PlatformEvent<EventPayload>);
          if (!customerId) return;
          await evaluateCustomerForTenant(event.tenantId, customerId);
        })
      )
    );
  }

  // A NEW SEGMENT HAS TO FILL ITSELF, and nothing made it.
  //
  // Everything above is CUSTOMER-driven: when one person changes, re-check that
  // person against every segment. Creating a segment changes no person, so a
  // brand-new segment matched nobody until some unrelated customer happened to
  // be touched. The builder counted "24 of 24 match" while you typed the rules,
  // you pressed Create, and the list said "No members yet" — with the screen
  // still promising that "anyone who matches is added automatically". It is the
  // same reason most of the built-in segments sat at zero.
  //
  // The other direction: EDITING the rules re-cuts the group, so a member who no
  // longer matches has to leave. `rulesChanged` is already on the event, so only
  // a real rule change pays for the scan — renaming a segment does not.
  for (const topic of ['crm.segment.created', 'crm.segment.updated']) {
    teardowns.push(
      ctx.bus.subscribe(
        topic,
        gateHandler<unknown>(async (event) => {
          const payload = (event as PlatformEvent<SegmentEventPayload>).payload;
          if (!payload?.segmentId) return;
          if (topic === 'crm.segment.updated' && payload.rulesChanged === false) return;
          // Here rather than inline in the service on purpose: this walks every
          // customer in the tenant, and an owner pressing Create should not wait
          // on it (docs/02 — side effects are consumed, not inlined).
          const { recomputeFull } = await import('../services/segment-evaluation');
          await recomputeFull(
            { tenantId: event.tenantId, userId: undefined },
            { segmentId: payload.segmentId }
          );
        })
      )
    );
  }

  return teardowns;
}

/** Extract the customerId from an event payload. For order events without
 *  an explicit customerId, we hit Prisma to look it up — adding a few ms
 *  is preferable to schema-coupling every consumer to the same payload. */
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

/** Re-evaluate every active segment for one customer; diff against the
 *  current segment_members rows and write entries/exits accordingly. */
export async function evaluateCustomerForTenant(
  tenantId: string,
  customerId: string
): Promise<{ entered: string[]; exited: string[] }> {
  const ctx = { tenantId, userId: undefined };
  const projection = await buildSegmentRuleProjection(ctx, customerId).catch(() => null);
  if (!projection) return { entered: [], exited: [] };

  const entered: string[] = [];
  const exited: string[] = [];

  await withTenant(ctx, async (tx) => {
    // A customer is only evaluated against segments of THEIR OWN site, plus the
    // tenant-wide ones (docs/131 §5). Without this a Savory Donuts customer could
    // land in a Bob's Parts segment and then receive its broadcast — the leak
    // this scoping closes. The customer's site is authoritative here (a segment
    // draws FROM a site's customers), so it bounds the query.
    const customer = await tx.customer.findUnique({
      where: { id: customerId },
      select: { propertyId: true },
    });
    const segments = await tx.segment.findMany({
      where: {
        archivedAt: null,
        // STATIC LISTS ARE NOT THE EVALUATOR'S BUSINESS (docs/144 §10). A
        // hand-picked list has no rules to re-derive membership from, so
        // evaluating one would find nothing matched and remove everybody —
        // emptying a list somebody built by hand, on the next event that touched
        // any of its members. This one clause is the whole contract.
        kind: 'dynamic',
        ...(customer?.propertyId
          ? { OR: [{ propertyId: customer.propertyId }, { propertyId: null }] }
          : {}),
      },
    });

    for (const segment of segments) {
      const parsed = SegmentRuleSchema.safeParse(segment.rules);
      if (!parsed.success) continue;
      const rule = parsed.data satisfies SegmentRule;

      const shouldBeMember = evaluateSegmentRule(rule, projection);
      const existing = await tx.segmentMember.findUnique({
        where: { segmentId_customerId: { segmentId: segment.id, customerId } },
      });

      if (shouldBeMember && !existing) {
        await tx.segmentMember.create({
          data: {
            tenantId,
            segmentId: segment.id,
            customerId,
          },
        });
        // The membership row records that they ARE on the list; this records
        // that they JOINED, and survives them leaving again (docs/144 §10).
        await tx.segmentMembershipEvent.create({
          data: { tenantId, segmentId: segment.id, customerId, kind: 'entered', source: 'rule' },
        });
        entered.push(segment.id);
      } else if (!shouldBeMember && existing) {
        await tx.segmentMember.delete({
          where: { segmentId_customerId: { segmentId: segment.id, customerId } },
        });
        await tx.segmentMembershipEvent.create({
          data: { tenantId, segmentId: segment.id, customerId, kind: 'exited', source: 'rule' },
        });
        exited.push(segment.id);
      }
    }
  });

  // Fire events outside the transaction so a failed publish doesn't roll
  // back the membership write.
  for (const segmentId of entered) {
    await publishCrmEvent({
      tenantId,
      topic: 'crm.segment.entered',
      payload: { segmentId, customerId },
      dedupeKey: `crm.segment.entered:${segmentId}:${customerId}`,
    });
  }
  for (const segmentId of exited) {
    await publishCrmEvent({
      tenantId,
      topic: 'crm.segment.exited',
      payload: { segmentId, customerId },
      dedupeKey: `crm.segment.exited:${segmentId}:${customerId}:${Date.now()}`,
    });
  }

  return { entered, exited };
}
