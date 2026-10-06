// Starting a repeat order from a paid checkout (issue 739).
//
// A shopper who chose "deliver every month" pays for the first one at checkout,
// and that same payment keeps their card. Nothing can be started at the moment
// the order is placed, because the order is placed BEFORE the gateway confirms
// the money: on a hosted page (Square, Authorize.net, PayPal) the shopper has not
// even paid yet. The only moment that is true for all five gateways is the one
// the payment reconciler marks the order paid.
//
// So this runs from the subscription tick, every 15 minutes, beside the renewals
// it creates. It finds paid orders whose lines asked for a repeat and have none
// yet, keeps the card the payment saved, and starts one repeat order per cadence
// on it. The order line is marked with the repeat order's id in the SAME
// transaction that creates it, so a second pass, a crash or a redelivery can
// never start two.
//
// If the card cannot be kept, the repeat order still starts, billing by an
// emailed payment link instead (`billingMode: 'invoice'`). The shopper asked for
// the delivery, and losing it because a vault call failed would be worse than
// asking them to pay by link. A transient failure is retried on the next two
// passes first, so a gateway having a bad minute does not cost anyone their card.

import { paymentService, StoredMethodsUnsupportedError } from '@wizeworks/payments';
import type { Prisma } from '@wizeworks/db';
import { withTenant } from '@wizeworks/db';
import { RepeatCadence, cadenceKey } from '@wizeworks/commerce-schemas';

import type { ServiceContext } from '../errors';
import * as paymentMethodService from './payment-method-service';
import { choiceFromOrder } from './renewal-pricing';
import * as subscriptionService from './subscription-service';

/** How far back a paid order is still looked at. A line older than this that
 *  never started has a reason that a retry will not fix, and re-reading it
 *  every 15 minutes for ever would only add noise. */
const LOOKBACK_DAYS = 30;

/** Passes a card read may fail before the repeat order starts on invoice. */
const CARD_ATTEMPTS = 3;

/** What a repeat order line records on the order, in `order_items.metadata.repeat`. */
interface LineRepeat extends RepeatCadence {
  /** Set once the repeat order exists. Its presence is "done". */
  subscriptionId?: string;
  /** Card reads that failed so far. */
  attempts?: number;
}

export interface RepeatStartOutcome {
  orderId: string;
  /** started = repeat orders exist now · waiting = will try the card again next
   *  pass · skipped = nothing a retry can fix (recorded on the line). */
  result: 'started' | 'waiting' | 'skipped';
  subscriptionIds: string[];
  billingMode?: 'card' | 'invoice';
}

/** Paid orders with at least one line asking for a repeat that has none yet. */
export async function findOrdersAwaitingRepeat(
  ctx: ServiceContext,
  limit: number
): Promise<string[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT o.id
      FROM orders o
      JOIN order_items i ON i.order_id = o.id
      WHERE o.payment_status = 'paid'
        AND o.status NOT IN ('cancelled', 'refunded')
        -- \`::int\`: a JS number is sent as bigint, and make_interval takes int.
        -- Without the cast this query failed on every pass.
        AND o.paid_at >= now() - make_interval(days => ${LOOKBACK_DAYS}::int)
        AND i.metadata ? 'repeat'
        AND NOT (i.metadata -> 'repeat' ? 'subscriptionId')
        AND NOT (i.metadata -> 'repeat' ? 'skipped')
      LIMIT ${limit}
    `;
    return rows.map((row) => row.id);
  });
}

export function readLineRepeat(metadata: Prisma.JsonValue): LineRepeat | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, unknown>).repeat;
  if (!raw || typeof raw !== 'object') return null;
  const cadence = RepeatCadence.safeParse(raw);
  if (!cadence.success) return null;
  const extra = raw as { subscriptionId?: unknown; attempts?: unknown; skipped?: unknown };
  if (typeof extra.skipped === 'string') return null;
  return {
    ...cadence.data,
    ...(typeof extra.subscriptionId === 'string' ? { subscriptionId: extra.subscriptionId } : {}),
    ...(typeof extra.attempts === 'number' ? { attempts: extra.attempts } : {}),
  };
}

function withRepeat(
  metadata: Prisma.JsonValue,
  repeat: Record<string, unknown>
): Prisma.InputJsonValue {
  const base =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  return { ...base, repeat } as Prisma.InputJsonValue;
}

/**
 * Start the repeat orders one paid order asked for. Safe to call again: lines
 * already started are skipped, so a second pass does nothing.
 */
export async function startForOrder(
  ctx: ServiceContext,
  orderId: string
): Promise<RepeatStartOutcome> {
  const order = await withTenant(ctx, (tx) =>
    tx.order.findFirst({
      where: { id: orderId },
      select: {
        id: true,
        customerId: true,
        propertyId: true,
        currency: true,
        paymentStatus: true,
        shippingAddress: true,
        billingAddress: true,
        metadata: true,
        items: {
          select: {
            id: true,
            variantId: true,
            quantity: true,
            unitPrice: true,
            metadata: true,
          },
        },
        payments: {
          where: { status: 'captured' },
          select: { processorRef: true, metadata: true },
          orderBy: { capturedAt: 'asc' },
          take: 1,
        },
      },
    })
  );
  if (order?.paymentStatus !== 'paid') {
    return { orderId, result: 'skipped', subscriptionIds: [] };
  }

  const pending = order.items
    .map((item) => ({ item, repeat: readLineRepeat(item.metadata) }))
    .filter(
      (entry): entry is { item: (typeof order.items)[number]; repeat: LineRepeat } =>
        entry.repeat !== null &&
        entry.repeat.subscriptionId === undefined &&
        entry.item.variantId !== null
    );
  if (pending.length === 0) return { orderId, result: 'skipped', subscriptionIds: [] };

  // A repeat delivery needs somewhere to deliver. Checkout refuses a repeat line
  // on a collected order, so this only meets one placed some other way; it is
  // recorded on the line rather than retried, because no retry gives it an address.
  if (!order.shippingAddress) {
    await withTenant(ctx, async (tx) => {
      for (const { item, repeat } of pending) {
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            metadata: withRepeat(item.metadata, { ...repeat, skipped: 'no_delivery_address' }),
          },
        });
      }
    });
    return { orderId, result: 'skipped', subscriptionIds: [] };
  }

  const orderMeta = (order.metadata ?? {}) as Record<string, unknown>;
  const payment = order.payments[0];
  const paymentRef =
    payment?.processorRef ??
    (typeof orderMeta.paymentRef === 'string' ? orderMeta.paymentRef : null);
  const paymentMeta = (payment?.metadata ?? {}) as Record<string, unknown>;
  const chargeRef =
    typeof paymentMeta.transactionRef === 'string' ? paymentMeta.transactionRef : undefined;
  const attempts = Math.max(...pending.map((entry) => entry.repeat.attempts ?? 0));

  // Keep the card the payment saved.
  let paymentMethodId: string | null = null;
  let cardFailure: string | null = null;
  if (paymentRef) {
    try {
      const kept = await paymentMethodService.keepFromPayment(ctx, {
        customerId: order.customerId,
        paymentRef,
        ...(chargeRef ? { chargeRef } : {}),
      });
      if (kept) paymentMethodId = kept.id;
      else cardFailure = 'The payment did not keep a card.';
    } catch (err) {
      cardFailure = err instanceof Error ? err.message : String(err);
      // A gateway that cannot keep cards will not learn to on the next pass.
      const permanent = err instanceof StoredMethodsUnsupportedError;
      if (!permanent && attempts + 1 < CARD_ATTEMPTS) {
        await withTenant(ctx, async (tx) => {
          for (const { item, repeat } of pending) {
            await tx.orderItem.update({
              where: { id: item.id },
              data: { metadata: withRepeat(item.metadata, { ...repeat, attempts: attempts + 1 }) },
            });
          }
        });
        return { orderId, result: 'waiting', subscriptionIds: [] };
      }
    }
  } else {
    cardFailure = 'The order has no record of the payment that paid it.';
  }

  const providerSlug =
    typeof orderMeta.paymentProviderSlug === 'string'
      ? orderMeta.paymentProviderSlug
      : (await paymentService.getGatewayForTenant(ctx.tenantId)).id;
  const billingMode = paymentMethodId ? 'card' : 'invoice';

  // One repeat order per cadence: a box every month and a refill every two weeks
  // are two schedules, and a single subscription has one.
  const groups = new Map<string, { cadence: RepeatCadence; entries: typeof pending }>();
  for (const entry of pending) {
    const key = cadenceKey(entry.repeat);
    const group = groups.get(key) ?? { cadence: entry.repeat, entries: [] };
    group.entries.push(entry);
    groups.set(key, group);
  }

  const subscriptionIds: string[] = [];
  for (const { cadence, entries } of groups.values()) {
    const id = await withTenant(ctx, async (tx) => {
      const created = await subscriptionService.create(
        { ...ctx, tx },
        {
          customerId: order.customerId,
          ...(order.propertyId ? { propertyId: order.propertyId } : {}),
          channel: 'storefront',
          currency: order.currency,
          // The first delivery was this order. The next is one interval later.
          schedule: { intervalUnit: cadence.intervalUnit, intervalCount: cadence.intervalCount },
          items: entries.map(({ item }) => ({
            variantId: item.variantId!,
            quantity: item.quantity,
            unitPriceCents: Math.round(Number(item.unitPrice) * 100),
          })),
          shippingAddress: order.shippingAddress,
          ...(order.billingAddress ? { billingAddress: order.billingAddress } : {}),
          paymentProviderSlug: providerSlug,
          billingMode,
          ...(paymentMethodId ? { paymentMethodId } : {}),
        }
      );
      // The delivery option the shopper chose, so each renewal prices the same
      // one again (issue 916). Without it a renewal falls back to the cheapest
      // delivery, which is not what she picked.
      const shippingChoice = choiceFromOrder(order.metadata);
      if (shippingChoice) {
        await tx.subscription.update({
          where: { id: created.id },
          data: { shippingChoice: shippingChoice as unknown as Prisma.InputJsonValue },
        });
      }
      await tx.subscriptionEvent.create({
        data: {
          tenantId: ctx.tenantId,
          subscriptionId: created.id,
          event: 'started_from_order',
          payload: {
            orderId,
            ...(cardFailure ? { cardNotKept: cardFailure.slice(0, 400) } : {}),
          },
        },
      });
      for (const { item, repeat } of entries) {
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            metadata: withRepeat(item.metadata, {
              intervalUnit: repeat.intervalUnit,
              intervalCount: repeat.intervalCount,
              subscriptionId: created.id,
            }),
          },
        });
      }
      return created.id;
    });
    subscriptionIds.push(id);
  }

  return { orderId, result: 'started', subscriptionIds, billingMode };
}
