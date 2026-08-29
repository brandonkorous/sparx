// Whether a discount's CONDITIONS are met by a particular basket — and, when
// they are, which part of that basket the saving comes off.
//
// `discount.conditions` has been stored, edited and shown in the console since
// the module shipped, and nothing ever read it. `redeemCode` checked the date
// window and the usage limits and then took the percentage off the whole cart,
// so "minimum spend $100" applied to a $42 basket and a core-range-only
// promotion came off a dress that was meant to be excluded.
//
// Everything here is deliberately about the CART. Conditions needing context
// this layer does not have (`fitment_matches`), or describing a per-line
// promotion the pricing pipeline builds (`buy_x_get_y`), are not gates.

import type { DiscountCondition } from '@wizeworks/commerce-schemas';
import type { TxClient } from '@wizeworks/db';

/** One basket line, reduced to what a condition can ask about. */
export interface CartLineFacts {
  /** The cart line's own id. Two lines can hold the same product in different
   *  sizes, so a discount's share cannot be keyed on the product. */
  id: string;
  productId: string;
  quantity: number;
  subtotalCents: number;
}

/** Everything the conditions can be evaluated against, gathered once. */
export interface CartFacts {
  lines: CartLineFacts[];
  subtotalCents: number;
  itemCount: number;
  customerId: string | null;
  channel: string;
  /** Collections each basket product belongs to. Empty unless asked for. */
  collectionsByProduct: Map<string, Set<string>>;
  /** Null when no condition asked, so "unknown" never reads as "no". */
  hasOrderedBefore: boolean | null;
  segmentIds: Set<string>;
  b2bAccountIds: Set<string>;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Products the discount is limited to, or null when it is not limited. */
function allowedProducts(conditions: DiscountCondition[], facts: CartFacts): Set<string> | null {
  const limits = conditions.filter((c) => c.kind === 'product_in' || c.kind === 'collection_in');
  if (limits.length === 0) return null;

  const allowed = new Set<string>();
  for (const condition of limits) {
    if (condition.kind === 'product_in') {
      for (const id of condition.value) allowed.add(id);
    } else if (condition.kind === 'collection_in') {
      const wanted = new Set(condition.value);
      for (const [productId, collections] of facts.collectionsByProduct) {
        for (const collectionId of collections) {
          if (wanted.has(collectionId)) allowed.add(productId);
        }
      }
    }
  }
  return allowed;
}

/**
 * The part of the basket this discount comes off.
 *
 * With no product/collection restriction that is the whole subtotal, which is
 * what it always was. With one, only the qualifying lines — otherwise "15% off
 * the core range" quietly discounts the dress sitting beside it.
 */
export function eligibleBaseCents(conditions: DiscountCondition[], facts: CartFacts): number {
  const allowed = allowedProducts(conditions, facts);
  if (allowed === null) return facts.subtotalCents;
  return facts.lines
    .filter((line) => allowed.has(line.productId))
    .reduce((sum, line) => sum + line.subtotalCents, 0);
}

/**
 * The saving, split across the lines it actually came off.
 *
 * `eligibleBaseCents` answers what a discount is WORTH; this answers whose
 * money it was, which is a different question and the one an order needs. An
 * order line is what a refund, a margin and a commission are all read from, so
 * a line recording $42.00 for a shirt the shopper paid $35.70 for hands back
 * $6.30 that was never taken (issue 298).
 *
 * Shares are proportional to each eligible line's subtotal, with the leftover
 * cents going to the largest fractions first, so the parts sum to EXACTLY
 * `appliedCents` and an order's header can never disagree with its own lines.
 */
export function apportionToLines(
  conditions: DiscountCondition[],
  facts: CartFacts,
  appliedCents: number
): Map<string, number> {
  const shares = new Map<string, number>();
  if (appliedCents <= 0) return shares;

  const allowed = allowedProducts(conditions, facts);
  const paying = facts.lines.filter((line) => line.subtotalCents > 0);
  const eligible = paying.filter((line) => allowed === null || allowed.has(line.productId));
  // Nothing identifiable earned it — a saving stored against a basket that has
  // since been emptied or re-priced. Spreading it over what is left keeps the
  // money on the order instead of dropping it, which is the safer wrong answer.
  const over = eligible.length > 0 ? eligible : paying;
  const base = over.reduce((sum, line) => sum + line.subtotalCents, 0);
  if (base <= 0) return shares;

  const parts = over.map((line) => {
    const exact = (appliedCents * line.subtotalCents) / base;
    const whole = Math.floor(exact);
    return { id: line.id, cents: whole, fraction: exact - whole };
  });
  let left = appliedCents - parts.reduce((sum, part) => sum + part.cents, 0);
  for (const part of [...parts].sort((a, b) => b.fraction - a.fraction)) {
    if (left <= 0) break;
    part.cents += 1;
    left -= 1;
  }
  for (const part of parts) shares.set(part.id, (shares.get(part.id) ?? 0) + part.cents);
  return shares;
}

/**
 * Where `now` sits against an offer's own dates.
 *
 * The boundary lives here and nowhere else. `redeemCode` asks it when the code
 * is typed, and the cart asks it again every time its money is re-derived — and
 * if those two ever answered differently, a basket would go on carrying a saving
 * the shop had already ended (issue 300).
 */
export function discountWindowState(
  discount: { startAt: Date | null; endAt: Date | null },
  now: Date
): 'before' | 'running' | 'after' {
  if (discount.startAt && discount.startAt > now) return 'before';
  if (discount.endAt && discount.endAt < now) return 'after';
  return 'running';
}

/** Whether an offer can be given away right now: inside its dates, switched on,
 *  and not deleted. */
export function isDiscountRunning(
  discount: {
    status: string;
    startAt: Date | null;
    endAt: Date | null;
    deletedAt: Date | null;
  },
  now: Date
): boolean {
  if (discount.deletedAt !== null) return false;
  if (discount.status !== 'active') return false;
  return discountWindowState(discount, now) === 'running';
}

/** Why an offer is spent, or null when it is not. Two limits, two sentences. */
export type UsageBlock = 'total' | 'customer' | null;

/**
 * Has this offer run out — for the shop, or for this shopper?
 *
 * The counting is the caller's, because one caller has a transaction open and the
 * other is mid-fold; the COMPARISON is here so there is one answer. It used to live
 * only inside `assertUsageLimit`, which runs when a code is typed and never again,
 * so a basket went on carrying a saving its owner had already spent and carried it
 * through checkout (issue 312) — the same shape as the sale-window bug in 300, on
 * the other half of the same sentence.
 */
export function usageBlock(
  discount: { perCustomerLimit: number; totalUsageLimit: number | null; usageCount: number },
  usedByCustomer: number | null
): UsageBlock {
  if (discount.totalUsageLimit !== null && discount.usageCount >= discount.totalUsageLimit) {
    return 'total';
  }
  // Null means nobody to count against — a guest basket, where only the shop-wide
  // limit can be checked at all.
  if (usedByCustomer !== null && usedByCustomer >= discount.perCustomerLimit) {
    return 'customer';
  }
  return null;
}

/** The stored `conditions` column as the union it is. Jsonb, so anything not an
 *  array means a discount with no conditions rather than a broken one. */
export function readConditions(stored: unknown): DiscountCondition[] {
  return Array.isArray(stored) ? (stored as DiscountCondition[]) : [];
}

/**
 * Why this basket cannot use the discount, in a sentence a shopper can act on,
 * or null when nothing stands in the way.
 *
 * The wording is the point: "conditions not met" tells somebody nothing, while
 * the amount they are short tells them exactly what to do next.
 */
export function refusalReason(conditions: DiscountCondition[], facts: CartFacts): string | null {
  for (const condition of conditions) {
    switch (condition.kind) {
      case 'min_subtotal_cents': {
        if (facts.subtotalCents >= condition.value) break;
        const short = condition.value - facts.subtotalCents;
        return `This code needs a basket of at least ${money(condition.value)}. Add ${money(short)} more to use it.`;
      }
      case 'min_item_count': {
        if (facts.itemCount >= condition.value) break;
        const noun = condition.value === 1 ? 'item' : 'items';
        return `This code needs at least ${condition.value} ${noun} in your basket.`;
      }
      case 'first_order_only': {
        if (!condition.value) break;
        if (facts.hasOrderedBefore === true) return 'This code is for a first order only.';
        break;
      }
      case 'customer_segment_in': {
        if (condition.value.some((id) => facts.segmentIds.has(id))) break;
        return 'This code is not available on this account.';
      }
      case 'b2b_account_in': {
        if (condition.value.some((id) => facts.b2bAccountIds.has(id))) break;
        return 'This code is not available on this account.';
      }
      case 'channel_in': {
        if ((condition.value as string[]).includes(facts.channel)) break;
        return 'This code cannot be used here.';
      }
      default:
        break;
    }
  }

  // product_in / collection_in are answered together: two restrictions are an
  // OR, so a basket qualifies when ANY line is covered by ANY of them.
  const allowed = allowedProducts(conditions, facts);
  if (allowed !== null && !facts.lines.some((line) => allowed.has(line.productId))) {
    return 'This code does not apply to anything in your basket.';
  }

  return null;
}

function asks(conditions: DiscountCondition[], kind: DiscountCondition['kind']): boolean {
  return conditions.some((c) => c.kind === kind);
}

/**
 * Gather exactly the facts these conditions ask for.
 *
 * Each extra lookup is a query on the path a shopper waits on, so an
 * unrestricted code still costs one read of the basket and nothing else.
 */
export async function gatherCartFacts(
  tx: TxClient,
  cart: { id: string; customerId: string | null; channel: string },
  conditions: DiscountCondition[]
): Promise<CartFacts> {
  const items = await tx.cartItem.findMany({
    where: { cartId: cart.id },
    select: {
      id: true,
      quantity: true,
      subtotalCents: true,
      variant: { select: { productId: true } },
    },
  });

  const lines: CartLineFacts[] = items.map((item) => ({
    id: item.id,
    productId: item.variant.productId,
    quantity: item.quantity,
    subtotalCents: item.subtotalCents,
  }));

  const collectionsByProduct = new Map<string, Set<string>>();
  if (asks(conditions, 'collection_in') && lines.length > 0) {
    const rows = await tx.collectionProduct.findMany({
      where: { productId: { in: lines.map((l) => l.productId) } },
      select: { productId: true, collectionId: true },
    });
    for (const row of rows) {
      const set = collectionsByProduct.get(row.productId) ?? new Set<string>();
      set.add(row.collectionId);
      collectionsByProduct.set(row.productId, set);
    }
  }

  let hasOrderedBefore: boolean | null = null;
  if (asks(conditions, 'first_order_only') && cart.customerId) {
    hasOrderedBefore = (await tx.order.count({ where: { customerId: cart.customerId } })) > 0;
  }

  const segmentIds = new Set<string>();
  if (asks(conditions, 'customer_segment_in') && cart.customerId) {
    const rows = await tx.segmentMember.findMany({
      where: { customerId: cart.customerId },
      select: { segmentId: true },
    });
    for (const row of rows) segmentIds.add(row.segmentId);
  }

  const b2bAccountIds = new Set<string>();
  if (asks(conditions, 'b2b_account_in') && cart.customerId) {
    const rows = await tx.b2bAccountContact.findMany({
      where: { customerId: cart.customerId },
      select: { accountId: true },
    });
    for (const row of rows) b2bAccountIds.add(row.accountId);
  }

  return {
    lines,
    subtotalCents: lines.reduce((sum, l) => sum + l.subtotalCents, 0),
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    customerId: cart.customerId,
    channel: cart.channel,
    collectionsByProduct,
    hasOrderedBefore,
    segmentIds,
    b2bAccountIds,
  };
}
