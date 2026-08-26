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
    select: { quantity: true, subtotalCents: true, variant: { select: { productId: true } } },
  });

  const lines: CartLineFacts[] = items.map((item) => ({
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
