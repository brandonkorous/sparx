// A business's buying rules on one version of a product, as the trade pricing
// pane reads and writes them (sparx persona issue 086): the least it may order
// at once, the most, and the case pack it buys in.
//
// The server refuses the same settings with the same sentences
// (`overrideSettingProblem` in @wizeworks/b2b); these say it while the boxes are
// being filled in, so Save is never the first place staff hear it.

export interface BuyingRuleValues {
  minOrderQty: number | null;
  maxOrderQty: number | null;
  orderMultiple: number | null;
}

/** What one box holds: nothing, a whole number above zero, or something else. */
export type RuleBox = number | null | 'invalid';

export function readRuleBox(text: string): RuleBox {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isInteger(n) && n >= 1 ? n : 'invalid';
}

export function hasBuyingRule(rule: BuyingRuleValues): boolean {
  return rule.minOrderQty !== null || rule.maxOrderQty !== null || rule.orderMultiple !== null;
}

/** "Sold in cases of 12 · at least 24 · no more than 96", or null. */
export function buyingRuleWords(rule: BuyingRuleValues): string | null {
  const parts = [
    rule.orderMultiple !== null && rule.orderMultiple > 1
      ? `sold in cases of ${String(rule.orderMultiple)}`
      : null,
    rule.minOrderQty !== null ? `at least ${String(rule.minOrderQty)} at a time` : null,
    rule.maxOrderQty !== null ? `no more than ${String(rule.maxOrderQty)} at a time` : null,
  ].filter((p): p is string => p !== null);
  if (parts.length === 0) return null;
  const sentence = parts.join(' · ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

function casesNear(n: number, each: number): string {
  const down = Math.floor(n / each) * each;
  const up = Math.ceil(n / each) * each;
  return down >= each ? `${String(down)} or ${String(up)}` : String(up);
}

/** Why these three boxes cannot be saved, or null. */
export function buyingRuleProblem(boxes: {
  min: RuleBox;
  max: RuleBox;
  caseOf: RuleBox;
}): string | null {
  if (boxes.min === 'invalid' || boxes.max === 'invalid' || boxes.caseOf === 'invalid') {
    return 'Use whole numbers of 1 or more, or leave a box empty for no rule.';
  }
  const { min, max, caseOf } = boxes;
  if (min !== null && max !== null && min > max) {
    return `The minimum (${String(min)}) is more than the maximum (${String(max)}). Make the minimum smaller or the maximum larger.`;
  }
  if (caseOf !== null && caseOf > 1) {
    if (min !== null && min % caseOf !== 0) {
      return `A minimum of ${String(min)} cannot be bought in cases of ${String(caseOf)}. Use ${casesNear(min, caseOf)}.`;
    }
    if (max !== null && max % caseOf !== 0) {
      return `A maximum of ${String(max)} cannot be bought in cases of ${String(caseOf)}. Use ${casesNear(max, caseOf)}.`;
    }
  }
  return null;
}

/** What the boxes mean for the buyer, once they are valid: the sentence the
 *  business's buyers will meet on the website. */
export function buyingRuleEffect(rule: BuyingRuleValues, accountName: string): string {
  const words = buyingRuleWords(rule);
  if (!words) return `${accountName} can order any amount.`;
  return `${accountName} sees this beside the quantity box on your website, and the cart and checkout refuse any other amount with the nearest ones that would work.`;
}
