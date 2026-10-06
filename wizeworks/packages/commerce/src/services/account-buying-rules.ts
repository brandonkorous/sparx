// What a trade account may order, and who on it may order at all
// (sparx persona issue 086).
//
// The /b2b page promised three things nothing enforced:
//
//   · Quantity rules per product per account: a minimum, a maximum and a case
//     pack ("Wasatch buys this filter in cases of 12"). The minimum and maximum
//     sat on `b2b_account_product_overrides` and were read only by fleet holds;
//     the cart and checkout let anyone buy any amount.
//   · A minimum order value per account, from the account's wholesale group
//     (`B2bPricingTier.minOrderCents`). The console edited it and told staff the
//     group price applied "only on orders over $X", while no code read it.
//   · Contact roles. A view-only contact could fill a cart and place an order on
//     the account, because cart and checkout checked only that the contact was
//     active.
//
// Everything here is keyed off the SIGNED-IN contact's account, the same active
// membership pricing uses (`resolveActiveB2bAccountId`). A guest or a retail
// shopper has no account, so none of it applies to them.
//
// Rounding versus refusing: an amount that breaks a rule is REFUSED, with the
// nearest amounts that would be accepted named in the sentence. Rounding 5 up to
// a case of 12 would put more than twice what somebody asked for into their
// basket without them choosing it, and on an account billed later that is a
// surprise on an invoice. A refusal that offers "12, 24 or 36" costs one click.

import type { TxClient } from '@wizeworks/db';

import {
  hasQuantityRule,
  productLabel,
  quantityProblem,
  quantityRuleWords,
  quantityStep,
  startingQuantity,
  type QuantityRule,
} from '@wizeworks/commerce-schemas';

import { CommerceValidationError } from '../errors';

import { formatCents } from './money';

// ─── Quantity rules ──────────────────────────────────────────────────
//
// The arithmetic and the sentences live in @wizeworks/commerce-schemas
// (`quantity-rules.ts`), so a fleet hold refuses in the same words as the cart.
// Re-exported so callers of this module keep one import.
export {
  hasQuantityRule,
  highestAllowed,
  isAllowedQuantity,
  lowestAllowed,
  nearestAllowed,
  productLabel,
  quantityProblem,
  quantityRuleWords,
  quantityStep,
  startingQuantity,
  type QuantityRule,
} from '@wizeworks/commerce-schemas';

/** Every version's rule for one account, read in one query. A version with two
 *  override rows takes the oldest that says anything about quantity. */
export async function loadQuantityRules(
  tx: TxClient,
  accountId: string,
  variantIds: readonly string[]
): Promise<Map<string, QuantityRule>> {
  const rules = new Map<string, QuantityRule>();
  if (variantIds.length === 0) return rules;
  const rows = await tx.b2bAccountProductOverride.findMany({
    where: { accountId, variantId: { in: [...variantIds] } },
    orderBy: { createdAt: 'asc' },
    select: { variantId: true, minOrderQty: true, maxOrderQty: true, orderMultiple: true },
  });
  for (const row of rows) {
    if (!row.variantId || rules.has(row.variantId)) continue;
    const rule: QuantityRule = {
      minimum: row.minOrderQty,
      maximum: row.maxOrderQty,
      caseOf: row.orderMultiple,
    };
    if (hasQuantityRule(rule)) rules.set(row.variantId, rule);
  }
  return rules;
}

async function labelOf(tx: TxClient, variantId: string): Promise<string> {
  const variant = await tx.productVariant.findFirst({
    where: { id: variantId },
    select: { sku: true, title: true, product: { select: { title: true } } },
  });
  if (!variant) return 'this product';
  return productLabel(variant.product, variant.title);
}

// ─── Who may order ───────────────────────────────────────────────────

/**
 * The contact roles that may place an order on an account.
 *
 * `viewer` is read-only by definition: AP looks at invoices and statements.
 *
 * `approver` may not place orders either, and that is a choice. An approver's
 * job (docs/10 §8, and the role note in 62-b2b-contacts.prisma) is to be the
 * second person who looks at a purchase; letting the same person place it as
 * well turns the check into one person agreeing with themselves. It also
 * matches the rule quotes already follow in the portal route, where
 * `approver` and `viewer` are read-only (sparx persona issue 086).
 */
export const ORDERING_ROLES: ReadonlySet<string> = new Set(['primary_contact', 'buyer']);

/** The sentence a contact who cannot order is shown, or null when they can. */
export function orderingRefusal(
  role: string,
  accountName: string,
  askName: string | null
): string | null {
  if (ORDERING_ROLES.has(role)) return null;
  const ask = askName
    ? `Ask ${askName} to place orders.`
    : `Ask whoever orders for ${accountName} to place it, or ask us to change your role.`;
  if (role === 'viewer') return `Your account lets you see invoices and orders. ${ask}`;
  if (role === 'approver') {
    return `On the ${accountName} account you approve orders rather than place them. ${ask}`;
  }
  return `Your role on the ${accountName} account does not include placing orders. ${ask}`;
}

/** Where the signed-in contact stands on their account, for ordering. */
export interface AccountOrdering {
  accountId: string;
  accountName: string;
  role: string;
  canOrder: boolean;
  /** Why they cannot order, in a sentence; null when they can. */
  refusal: string | null;
}

/**
 * The signed-in contact's ACTIVE membership on their primary account, and
 * whether it lets them order. Null when there is no such membership: a guest,
 * a retail shopper, or a contact who has been switched off (who then shops
 * like anybody else, at list price, and is not ordering on the account).
 */
export async function resolveAccountOrdering(
  tx: TxClient,
  customerId: string | null | undefined,
  primaryAccountId: string | null | undefined
): Promise<AccountOrdering | null> {
  if (!customerId || !primaryAccountId) return null;
  const contact = await tx.b2bAccountContact.findFirst({
    where: { customerId, accountId: primaryAccountId, isActive: true },
    select: { role: true, account: { select: { companyName: true } } },
  });
  if (!contact) return null;
  const accountName = contact.account.companyName;
  if (ORDERING_ROLES.has(contact.role)) {
    return {
      accountId: primaryAccountId,
      accountName,
      role: contact.role,
      canOrder: true,
      refusal: null,
    };
  }
  // Somebody to send them to: the account's main contact first, then a buyer.
  const orderers = await tx.b2bAccountContact.findMany({
    where: {
      accountId: primaryAccountId,
      isActive: true,
      role: { in: [...ORDERING_ROLES] },
      customerId: { not: customerId },
    },
    select: { role: true, customer: { select: { firstName: true, lastName: true } } },
    take: 10,
  });
  const pick =
    orderers.find((c) => c.role === 'primary_contact' && c.customer.firstName) ??
    orderers.find((c) => c.customer.firstName);
  const firstName = pick?.customer.firstName?.trim();
  const askName = firstName === undefined || firstName === '' ? null : firstName;
  return {
    accountId: primaryAccountId,
    accountName,
    role: contact.role,
    canOrder: false,
    refusal: orderingRefusal(contact.role, accountName, askName),
  };
}

async function primaryAccountOf(tx: TxClient, customerId: string): Promise<string | null> {
  const customer = await tx.customer.findFirst({
    where: { id: customerId },
    select: { companyId: true },
  });
  return customer?.companyId ?? null;
}

/**
 * The gate on putting something in a cart, run by `cartService.addItem` for
 * every add (the product page, a reorder, a saved cart). Throws the sentence
 * the buyer is shown; returns quietly for a guest, a retail shopper, or a
 * buyer whose amount is allowed.
 */
export async function assertMayAddToCart(
  tx: TxClient,
  input: {
    customerId: string | null | undefined;
    primaryAccountId: string | null | undefined;
    variantId: string;
    /** The line's total after this add. */
    quantity: number;
    /** What the line held before this add. */
    alreadyInCart: number;
  }
): Promise<void> {
  const ordering = await resolveAccountOrdering(tx, input.customerId, input.primaryAccountId);
  if (!ordering) return;
  if (!ordering.canOrder) throw new CommerceValidationError(ordering.refusal ?? '');
  await assertQuantityAllowed(tx, ordering, input.variantId, input.quantity, input.alreadyInCart);
}

/**
 * The quantity half of the gate, for a change of amount on a line already in
 * the basket (`cartService.updateItem`). The cart's own customer decides the
 * account, never anything the caller sends.
 */
export async function assertCartLineQuantity(
  tx: TxClient,
  input: { cartId: string; variantId: string; quantity: number }
): Promise<void> {
  if (input.quantity <= 0) return;
  const cart = await tx.cart.findFirst({
    where: { id: input.cartId },
    select: { customerId: true },
  });
  if (!cart?.customerId) return;
  const ordering = await resolveAccountOrdering(
    tx,
    cart.customerId,
    await primaryAccountOf(tx, cart.customerId)
  );
  if (!ordering) return;
  await assertQuantityAllowed(tx, ordering, input.variantId, input.quantity, 0);
}

async function assertQuantityAllowed(
  tx: TxClient,
  ordering: AccountOrdering,
  variantId: string,
  quantity: number,
  alreadyInCart: number
): Promise<void> {
  const rule = (await loadQuantityRules(tx, ordering.accountId, [variantId])).get(variantId);
  if (!rule) return;
  const problem = quantityProblem(
    rule,
    quantity,
    { account: ordering.accountName, product: await labelOf(tx, variantId) },
    alreadyInCart
  );
  if (problem) throw new CommerceValidationError(problem);
}

// ─── Minimum order value ─────────────────────────────────────────────

/**
 * The account's minimum order, in cents, from its wholesale group. Null when
 * the account has no group, the group was deleted, or it sets no minimum.
 */
export async function minimumOrderCentsOf(tx: TxClient, accountId: string): Promise<number | null> {
  const account = await tx.company.findFirst({
    where: { id: accountId },
    select: { pricingTierFk: { select: { minOrderCents: true, deletedAt: true } } },
  });
  const tier = account?.pricingTierFk;
  // A missing group or a deleted one sets no minimum.
  if (tier?.deletedAt !== null || tier.minOrderCents <= 0) return null;
  return tier.minOrderCents;
}

/**
 * What a minimum is measured against: the goods, after any savings, before
 * delivery, tax and refundable deposits. Those three are not things the buyer
 * chose to spend, and counting them would let a long delivery distance carry
 * a small order over the line.
 */
export function goodsCents(cart: { subtotalCents: number; discountTotalCents: number }): number {
  return Math.max(0, cart.subtotalCents - cart.discountTotalCents);
}

/** "Add $112.40 more to reach your $500.00 minimum. …", or null when met. */
export function minimumOrderSentence(
  minimumCents: number | null,
  goods: number,
  currency: string
): string | null {
  if (minimumCents === null || goods >= minimumCents) return null;
  return `Add ${formatCents(minimumCents - goods, currency)} more to reach your ${formatCents(
    minimumCents,
    currency
  )} minimum. Orders on your account need to come to at least that much in goods, after any savings and before delivery and tax.`;
}

// ─── The basket, as a whole ──────────────────────────────────────────

/** One basket line's rule, for the cart page. */
export interface CartLineRule {
  cartItemId: string;
  minimum: number | null;
  maximum: number | null;
  caseOf: number | null;
  /** Where a quantity box for this line starts and how far it steps. */
  start: number;
  step: number;
  /** "Sold in cases of 12", "Minimum 24", "Up to 96 per order". */
  words: string[];
  /** Why the line's amount cannot be ordered, with what would work. */
  problem: string | null;
}

/** What a trade account's rules say about a basket, for the cart and checkout. */
export interface CartAccountRules {
  accountName: string;
  canOrder: boolean;
  /** Why this contact cannot order at all; null when they can. */
  orderingRefusal: string | null;
  /** Only the lines that carry a rule. */
  lines: CartLineRule[];
  minimumOrderCents: number | null;
  /** How much more the basket needs to reach the minimum; 0 when it is met. */
  shortfallCents: number;
  shortfallMessage: string | null;
}

/**
 * The account rules for a basket. Null for a basket with no signed-in trade
 * contact behind it, which is almost every basket.
 */
export async function cartAccountRules(
  tx: TxClient,
  cart: {
    customerId: string | null;
    currency: string;
    subtotalCents: number;
    discountTotalCents: number;
    items: {
      id: string;
      variantId: string;
      quantity: number;
      variant: { title: string | null; product: { title: string } };
    }[];
  }
): Promise<CartAccountRules | null> {
  if (!cart.customerId) return null;
  const ordering = await resolveAccountOrdering(
    tx,
    cart.customerId,
    await primaryAccountOf(tx, cart.customerId)
  );
  if (!ordering) return null;

  const rules = await loadQuantityRules(
    tx,
    ordering.accountId,
    cart.items.map((item) => item.variantId)
  );
  const lines: CartLineRule[] = [];
  for (const item of cart.items) {
    const rule = rules.get(item.variantId);
    if (!rule) continue;
    lines.push({
      cartItemId: item.id,
      minimum: rule.minimum,
      maximum: rule.maximum,
      caseOf: rule.caseOf,
      start: startingQuantity(rule),
      step: quantityStep(rule),
      words: quantityRuleWords(rule),
      problem: quantityProblem(rule, item.quantity, {
        account: ordering.accountName,
        product: productLabel(item.variant.product, item.variant.title),
      }),
    });
  }

  const minimumOrderCents = await minimumOrderCentsOf(tx, ordering.accountId);
  const goods = goodsCents(cart);
  return {
    accountName: ordering.accountName,
    canOrder: ordering.canOrder,
    orderingRefusal: ordering.refusal,
    lines,
    minimumOrderCents,
    shortfallCents: minimumOrderCents === null ? 0 : Math.max(0, minimumOrderCents - goods),
    shortfallMessage: minimumOrderSentence(minimumOrderCents, goods, cart.currency),
  };
}

/** The first reason a basket cannot be ordered on its account, or null. */
export function firstCartRefusal(rules: CartAccountRules | null): string | null {
  if (!rules) return null;
  if (!rules.canOrder) return rules.orderingRefusal;
  const line = rules.lines.find((l) => l.problem !== null);
  if (line) return line.problem;
  return rules.shortfallMessage;
}

/**
 * The checkout gate: run before a card is charged (payment intent), when
 * payment is recorded, and again when the order is placed, because a basket
 * can change, and an account's rules can change, while checkout is open.
 * `customerId` comes from the checkout session, never from the caller.
 */
export async function assertCartMayBeOrdered(
  tx: TxClient,
  input: { cartId: string; customerId: string | null }
): Promise<void> {
  if (!input.customerId) return;
  const cart = await tx.cart.findFirst({
    where: { id: input.cartId },
    select: {
      currency: true,
      subtotalCents: true,
      discountTotalCents: true,
      items: {
        select: {
          id: true,
          variantId: true,
          quantity: true,
          variant: { select: { title: true, product: { select: { title: true } } } },
        },
      },
    },
  });
  if (!cart) return;
  const refusal = firstCartRefusal(
    await cartAccountRules(tx, { ...cart, customerId: input.customerId })
  );
  if (refusal) throw new CommerceValidationError(refusal);
}
