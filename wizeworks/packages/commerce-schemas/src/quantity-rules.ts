// A trade account's buying rules on one version of a product, as pure arithmetic
// and sentences (sparx persona issue 086): a minimum, a maximum and a case pack.
//
// Here rather than in @wizeworks/commerce because two packages enforce the same
// rule and must refuse in the same words: the cart and checkout (commerce) and
// a fleet hold (inventory). Inventory cannot depend on commerce, and both
// already depend on this package.

// ─── Quantity rules ──────────────────────────────────────────────────

/** One account's buying rule for one version of a product. Null = no rule. */
export interface QuantityRule {
  minimum: number | null;
  maximum: number | null;
  /** Case pack: only multiples of this many. */
  caseOf: number | null;
}

/** Whether a rule row says anything about quantity. A price-only override does not. */
export function hasQuantityRule(rule: QuantityRule): boolean {
  return rule.minimum !== null || rule.maximum !== null || rule.caseOf !== null;
}

function step(rule: QuantityRule): number {
  return rule.caseOf !== null && rule.caseOf > 0 ? rule.caseOf : 1;
}

/** The smallest amount the rule allows (at least one). */
export function lowestAllowed(rule: QuantityRule): number {
  const each = step(rule);
  const floor = Math.max(1, rule.minimum ?? 1);
  return Math.ceil(floor / each) * each;
}

/** The largest amount the rule allows, or null when there is no maximum. */
export function highestAllowed(rule: QuantityRule): number | null {
  if (rule.maximum === null) return null;
  const each = step(rule);
  return Math.floor(rule.maximum / each) * each;
}

/** The amount a quantity box should start at for this rule. */
export function startingQuantity(rule: QuantityRule | null): number {
  return rule ? lowestAllowed(rule) : 1;
}

/** How far one press of + or - should move a quantity box. */
export function quantityStep(rule: QuantityRule | null): number {
  return rule ? step(rule) : 1;
}

export function isAllowedQuantity(rule: QuantityRule, quantity: number): boolean {
  const high = highestAllowed(rule);
  return (
    quantity >= lowestAllowed(rule) &&
    (high === null || quantity <= high) &&
    quantity % step(rule) === 0
  );
}

/** "12", "12 or 24", "12, 24 or 36". */
function listAmounts(amounts: number[]): string {
  const words = amounts.map((n) => String(n));
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} or ${words[words.length - 1] ?? ''}`;
}

/**
 * The allowed amounts closest to `quantity`: one either side when it sits
 * between two, or the first three upward when it is below everything allowed.
 */
export function nearestAllowed(rule: QuantityRule, quantity: number): number[] {
  const each = step(rule);
  const low = lowestAllowed(rule);
  const high = highestAllowed(rule);
  if (high !== null && high < low) return [];
  const within = (n: number) => n >= low && (high === null || n <= high);
  if (quantity < low) {
    return [low, low + each, low + 2 * each].filter(within);
  }
  if (high !== null && quantity > high) return [high];
  const down = Math.floor(quantity / each) * each;
  const up = Math.ceil(quantity / each) * each;
  return [...new Set([down, up])].filter(within);
}

/**
 * The rule as short phrases a buyer reads next to a quantity box:
 * "Sold in cases of 12", "Minimum 24", "Up to 96 per order". A minimum that
 * the case pack already implies (a minimum of 12 in cases of 12) is not said
 * twice.
 */
export function quantityRuleWords(rule: QuantityRule): string[] {
  const words: string[] = [];
  if (rule.caseOf !== null && rule.caseOf > 1)
    words.push(`Sold in cases of ${String(rule.caseOf)}`);
  const low = lowestAllowed(rule);
  if (low > step(rule)) words.push(`Minimum ${String(low)}`);
  const high = highestAllowed(rule);
  if (high !== null) words.push(`Up to ${String(high)} per order`);
  return words;
}

/**
 * Why `quantity` of a product cannot be ordered on this account, as a sentence
 * that names the product, the rule, and the amounts that would work. Null when
 * the amount is allowed.
 *
 * `alreadyInCart` is the amount the basket held before this add, so a buyer
 * adding 5 to the 12 they already have is told why 17 is the number in question.
 */
export function quantityProblem(
  rule: QuantityRule,
  quantity: number,
  names: { account: string; product: string },
  alreadyInCart = 0
): string | null {
  if (isAllowedQuantity(rule, quantity)) return null;
  const { account, product } = names;
  const near = nearestAllowed(rule, quantity);
  const already =
    alreadyInCart > 0
      ? ` You already have ${String(alreadyInCart)} in your cart, so that would make ${String(quantity)}.`
      : '';
  if (near.length === 0) {
    return `There is no amount of ${product} that ${account} can order at the moment. Ask us to check the buying rules on your account.`;
  }
  const cases =
    rule.caseOf !== null && rule.caseOf > 1 ? `, in cases of ${String(rule.caseOf)}` : '';
  const low = lowestAllowed(rule);
  const high = highestAllowed(rule);
  if (quantity < low && rule.minimum !== null && rule.minimum > step(rule)) {
    return `${account} buys at least ${String(low)} of ${product} at a time${cases}.${already} Choose ${
      step(rule) > 1 ? listAmounts(near) : `${String(low)} or more`
    }.`;
  }
  if (high !== null && quantity > high) {
    return `${account} can order up to ${String(high)} of ${product} at a time${cases}.${already} Choose ${String(high)} or fewer.`;
  }
  return `${account} buys ${product} in cases of ${String(step(rule))}.${already} Choose ${listAmounts(near)}.`;
}

/** "Oil filter" or "Work shirt (XL, Moss)": the product in the buyer's words. */
export function productLabel(product: { title: string }, variantTitle: string | null): string {
  return variantTitle && variantTitle.trim() !== '' && variantTitle !== product.title
    ? `${product.title} (${variantTitle})`
    : product.title;
}
