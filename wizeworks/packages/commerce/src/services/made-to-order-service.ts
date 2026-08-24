// Made to order — the database half of issue 026, which the arithmetic half
// (../made-to-order.ts) deliberately knows nothing about.
//
// Three callers share this and must agree: the product page (which tells a
// customer what is left today before they commit), the cart (which tells them
// as they add), and checkout completion (which is the authority, because a cart
// can sit open for a day and the answer changes underneath it).
//
// All of it is counted in the BUSINESS's own zone. "24 a day" means her day —
// counting in UTC would roll her allowance over at 6pm in Denver, mid-service.

import type { CartMadeToOrder } from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { Prisma } from '@wizeworks/db';

import { CommerceValidationError } from '../errors';
import type { ServiceContext } from '../errors';
import {
  FALLBACK_ZONE,
  localDayBounds,
  noticeDays,
  readyOnDate,
  remainingToday,
  splitDue,
  type MadeToOrderRule,
} from '../made-to-order';

type Tx = Prisma.TransactionClient;

/** The business's own zone, or UTC when nobody has said where they are. UTC is
 *  the only defensible fallback: it is the one that does not claim to know. */
export async function businessZone(tx: Tx): Promise<string> {
  const business = await tx.tenantBusiness.findFirst({ select: { timezone: true } });
  return business?.timezone ?? FALLBACK_ZONE;
}

export interface ProductRules extends MadeToOrderRule {
  productId: string;
  title: string;
}

/** The made-to-order rules behind a set of VARIANTS, keyed by variant id. The
 *  rules live on the product, but every line in a cart names a variant. */
export async function rulesByVariant(
  tx: Tx,
  variantIds: string[]
): Promise<Map<string, ProductRules>> {
  const out = new Map<string, ProductRules>();
  if (variantIds.length === 0) return out;
  const variants = await tx.productVariant.findMany({
    where: { id: { in: [...new Set(variantIds)] } },
    select: {
      id: true,
      product: {
        select: {
          id: true,
          title: true,
          orderAheadDays: true,
          depositType: true,
          depositAmountCents: true,
          depositPercent: true,
          dailyLimit: true,
        },
      },
    },
  });
  for (const variant of variants) {
    out.set(variant.id, { ...variant.product, productId: variant.product.id });
  }
  return out;
}

/**
 * How many of each product have already gone today, in the business's zone.
 *
 * Counted from ORDER LINES, not from stock, because the shops that set a daily
 * allowance are usually the ones tracking no stock at all. Cancelled orders
 * give their allowance back — the thing was never made.
 */
export async function soldToday(
  tx: Tx,
  productIds: string[],
  at: Date,
  zone: string
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (productIds.length === 0) return out;
  const { startUtc, endUtc } = localDayBounds(at, zone);
  const rows = await tx.orderItem.groupBy({
    by: ['productId'],
    where: {
      productId: { in: [...new Set(productIds)] },
      order: { placedAt: { gte: startUtc, lt: endUtc }, status: { not: 'cancelled' } },
    },
    _sum: { quantity: true },
  });
  for (const row of rows) {
    if (row.productId) out.set(row.productId, row._sum.quantity ?? 0);
  }
  return out;
}

/** What one product's allowance has left today, for a storefront that has to
 *  say so before somebody commits. Null when there is no allowance — which is
 *  not "unlimited" rendered as a number, and not zero either. */
export async function remainingTodayFor(
  ctx: ServiceContext,
  productId: string,
  dailyLimit: number | null,
  at: Date = new Date()
): Promise<number | null> {
  if (dailyLimit === null) return null;
  return withTenant(ctx, async (tx) => {
    const zone = await businessZone(tx);
    const sold = await soldToday(tx, [productId], at, zone);
    return remainingToday(dailyLimit, sold.get(productId) ?? 0);
  });
}

/**
 * One cart's whole made-to-order answer, against a total the CALLER supplies.
 *
 * The total is a parameter rather than read off the cart row because checkout
 * carries its own — the session's total moves as delivery and surcharges land,
 * and splitting the deposit off yesterday's number would charge the wrong card.
 */
export async function forCart(
  tx: Tx,
  cartId: string,
  totalCents: number,
  at: Date = new Date()
): Promise<CartMadeToOrder> {
  const items = await tx.cartItem.findMany({
    where: { cartId },
    select: {
      quantity: true,
      subtotalCents: true,
      variant: {
        select: {
          product: {
            select: {
              orderAheadDays: true,
              depositType: true,
              depositAmountCents: true,
              depositPercent: true,
              dailyLimit: true,
            },
          },
        },
      },
    },
  });
  const lines = items.map((it) => ({
    quantity: it.quantity,
    subtotalCents: it.subtotalCents,
    rule: it.variant.product satisfies MadeToOrderRule,
  }));
  const notice = noticeDays(lines);
  return {
    readyOn: readyOnDate(at, notice, await businessZone(tx)),
    noticeDays: notice,
    ...splitDue(lines, totalCents),
  };
}

export interface AllowanceLine {
  variantId: string;
  quantity: number;
}

/**
 * Refuse a basket that would take more of something than today has left.
 *
 * Called on add-to-cart so a customer hears it while they can still change
 * their mind, and again on completion because that is the only moment the
 * answer is binding. The message names the product and the number, because
 * "unavailable" sends somebody to reload the page and try again.
 */
export async function assertWithinDailyLimits(
  tx: Tx,
  lines: AllowanceLine[],
  at: Date = new Date()
): Promise<void> {
  const rules = await rulesByVariant(
    tx,
    lines.map((line) => line.variantId)
  );
  const capped = lines.filter((line) => (rules.get(line.variantId)?.dailyLimit ?? null) !== null);
  if (capped.length === 0) return;

  const zone = await businessZone(tx);
  const sold = await soldToday(
    tx,
    capped.map((line) => rules.get(line.variantId)!.productId),
    at,
    zone
  );

  // Two lines can name two variants of the SAME product, and each on its own
  // can fit inside an allowance the pair blows straight through.
  const wantedByProduct = new Map<string, number>();
  for (const line of capped) {
    const rule = rules.get(line.variantId)!;
    wantedByProduct.set(
      rule.productId,
      (wantedByProduct.get(rule.productId) ?? 0) + Math.max(0, line.quantity)
    );
  }

  for (const line of capped) {
    const rule = rules.get(line.variantId)!;
    const left = remainingToday(rule.dailyLimit, sold.get(rule.productId) ?? 0) ?? 0;
    const wanted = wantedByProduct.get(rule.productId) ?? 0;
    if (wanted > left) throw new CommerceValidationError(soldOutMessage(rule.title, left));
  }
}

/** What a person is told when today's allowance will not cover the order. It
 *  says what is left and that tomorrow starts again, because the alternative
 *  reads as "gone for good" and loses the sale that was actually available. */
export function soldOutMessage(title: string, left: number): string {
  if (left <= 0) {
    return `${title} is sold out for today. There will be more tomorrow.`;
  }
  return `Only ${String(left)} ${title} left for today. There will be more tomorrow.`;
}
