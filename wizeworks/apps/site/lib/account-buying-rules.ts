// A trade account's buying rules as the website shows them (sparx persona
// issue 086): a version's minimum, maximum and case pack beside its quantity
// box, the same on each basket line, the shortfall under the account's minimum
// order, and a view-only contact told why they cannot order and who can.
//
// The server decides all of it and refuses what breaks it; these helpers only
// turn its answer into what a page draws, so the page and the refusal cannot
// disagree.

/** One version's rule for the signed-in buyer's account (product page). */
export interface BuyingRule {
  minimum: number | null;
  maximum: number | null;
  caseOf: number | null;
  /** Where the quantity box starts. */
  start: number;
  /** How far one press of + or - moves it. */
  step: number;
  /** "Sold in cases of 12", "Minimum 24", "Up to 96 per order". */
  words: string[];
}

/** Whether the signed-in contact's role lets them order (product page). */
export interface AccountOrdering {
  /** The account, for "Add to quote request" (sparx persona issue 086). */
  accountId?: string;
  accountName: string;
  canOrder: boolean;
  refusal: string | null;
}

/** One basket line's rule (cart). */
export interface CartLineRule extends BuyingRule {
  cartItemId: string;
  /** Why the line's amount cannot be ordered, with what would work. */
  problem: string | null;
}

/** The account rules on a basket (cart and checkout). */
export interface CartAccountRules {
  accountName: string;
  canOrder: boolean;
  orderingRefusal: string | null;
  lines: CartLineRule[];
  minimumOrderCents: number | null;
  shortfallCents: number;
  shortfallMessage: string | null;
}

/** The rules as one sentence: "Sold in cases of 12. Minimum 24." */
export function ruleSentence(rule: { words: string[] } | null | undefined): string | null {
  if (!rule || rule.words.length === 0) return null;
  return `${rule.words.join('. ')}.`;
}

/** The rule on one basket line, or null when it has none. */
export function lineRule(
  rules: CartAccountRules | null | undefined,
  lineId: string
): CartLineRule | null {
  return rules?.lines.find((l) => l.cartItemId === lineId) ?? null;
}

/**
 * Why this basket cannot go to checkout yet, in the words the cart shows above
 * its checkout button, or null when it can. The server refuses the same
 * baskets; this is so nobody presses a button that is going to say no.
 */
export function checkoutBlock(rules: CartAccountRules | null | undefined): string | null {
  if (!rules) return null;
  if (!rules.canOrder) return rules.orderingRefusal;
  const broken = rules.lines.filter((l) => l.problem !== null).length;
  if (broken > 0) {
    return broken === 1
      ? 'One amount in your cart does not fit your account’s buying rules. Change the line marked below to check out.'
      : `${String(broken)} amounts in your cart do not fit your account’s buying rules. Change the lines marked below to check out.`;
  }
  return rules.shortfallMessage;
}

/** A quantity box value kept inside a rule: at least the start, whole steps. */
export function snapQuantity(rule: BuyingRule | null | undefined, wanted: number): number {
  if (!rule) return Math.max(1, Math.floor(wanted));
  const each = Math.max(1, rule.step);
  let n = Math.max(rule.start, Math.round(wanted / each) * each);
  if (rule.maximum !== null) {
    const top = Math.floor(rule.maximum / each) * each;
    if (top >= rule.start) n = Math.min(n, top);
  }
  return n;
}
