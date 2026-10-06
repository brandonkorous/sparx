// The product page's buy box, told about the signed-in trade buyer's account
// (sparx persona issue 086).
//
// The product page tenants actually get is a published silica tree, and every
// stamped buy box carries `<input name="quantity" value="1" min="1" step="1">`.
// A rule like "in cases of 12" is a fact about ONE BUYER, not about the page, so
// it cannot live in the published template. This adjusts the tree for the one
// request it is rendered for (a signed-in buyer's product read is never cached),
// so every product page already live picks it up with nothing to republish:
//
//   · the quantity box starts at the account's minimum and steps by its case,
//     when every version of the product carries the same rule;
//   · the rule is said in words just under the quantity box, per version when
//     the versions differ;
//   · a contact whose role cannot order sees why, and who can, in place of the
//     add-to-cart form. They still see the product, its price and its stock.
//
// The cart and checkout refuse whatever breaks a rule on their own; this is so
// the page says the rule before anyone presses the button.

import { ruleSentence, type AccountOrdering, type BuyingRule } from './account-buying-rules';

/** The parts of a product this reads. */
export interface ProductAccountBuying {
  accountOrdering?: AccountOrdering | null;
  variants: { id: string; sku: string; title: string | null; buyingRules?: BuyingRule | null }[];
}

type Attrs = Record<string, string | number | boolean>;
interface TreeNode {
  kind?: string;
  tag?: string;
  class?: string;
  attrs?: Attrs;
  children?: (TreeNode | string)[];
  data?: { kind?: string; ref?: string };
}

/** The action refs a buy box form carries. */
const BUY_ACTIONS = new Set(['add-to-cart', 'buy-now']);

function isBuyForm(node: TreeNode): boolean {
  return (
    node.kind === 'element' &&
    node.tag === 'form' &&
    node.data?.kind === 'action' &&
    BUY_ACTIONS.has(node.data.ref ?? '')
  );
}

function isQuantityInput(node: TreeNode): boolean {
  return node.kind === 'element' && node.tag === 'input' && node.attrs?.name === 'quantity';
}

/** The element the quantity box sits directly inside (in a stamped buy box,
 *  its `<label>`). */
function directlyHoldsQuantity(node: TreeNode): boolean {
  return (node.children ?? []).some((c) => typeof c !== 'string' && isQuantityInput(c));
}

function textNode(cls: string, text: string): TreeNode {
  return { kind: 'element', tag: 'p', class: cls, children: [text] };
}

function sameRule(a: BuyingRule, b: BuyingRule): boolean {
  return a.minimum === b.minimum && a.maximum === b.maximum && a.caseOf === b.caseOf;
}

/** What to do to the buy box for this product, or null to leave it alone. */
export function buyBoxPlan(product: ProductAccountBuying): {
  refusal: string | null;
  /** The rule to put on the quantity box itself; only when every version shares it. */
  boxRule: BuyingRule | null;
  /** The rule in words, one line per version when they differ. */
  lines: string[];
} | null {
  const ordering = product.accountOrdering ?? null;
  if (ordering && !ordering.canOrder) {
    return { refusal: ordering.refusal, boxRule: null, lines: [] };
  }
  const ruled = product.variants.filter((v) => v.buyingRules);
  if (ruled.length === 0) return null;
  const first = ruled[0]?.buyingRules ?? null;
  const uniform =
    first !== null &&
    ruled.length === product.variants.length &&
    ruled.every((v) => v.buyingRules && sameRule(v.buyingRules, first));
  if (uniform) {
    const sentence = ruleSentence(first);
    return { refusal: null, boxRule: first, lines: sentence ? [sentence] : [] };
  }
  const lines = ruled.flatMap((v) => {
    const sentence = ruleSentence(v.buyingRules);
    return sentence ? [`${v.title ?? v.sku}: ${sentence}`] : [];
  });
  return { refusal: null, boxRule: null, lines };
}

function adjustForm(form: TreeNode, plan: NonNullable<ReturnType<typeof buyBoxPlan>>): TreeNode {
  if (plan.refusal) {
    // The form goes, the explanation takes its place: a button that can only
    // ever be refused is worse than no button.
    return {
      kind: 'element',
      tag: 'div',
      class: 'mt-2 flex flex-col gap-2',
      attrs: { role: 'status' },
      children: [textNode('text-base font-medium text-base-content', plan.refusal)],
    };
  }
  const walk = (node: TreeNode, top: boolean): TreeNode => {
    if (isQuantityInput(node) && plan.boxRule) {
      const rule = plan.boxRule;
      return {
        ...node,
        attrs: {
          ...node.attrs,
          value: String(rule.start),
          min: String(rule.start),
          step: String(rule.step),
          ...(rule.maximum !== null ? { max: String(rule.maximum) } : {}),
        },
      };
    }
    if (!node.children) return node;
    const out: (TreeNode | string)[] = [];
    for (const child of node.children) {
      if (typeof child === 'string') {
        out.push(child);
        continue;
      }
      out.push(walk(child, false));
      // The words go straight after the quantity box's own wrapper (or the box,
      // when it sits loose in the form): beside it, before the button, where the
      // number is chosen. Exactly one place, however deep it is nested.
      if (directlyHoldsQuantity(child) || (top && isQuantityInput(child))) {
        for (const line of plan.lines) out.push(textNode('text-base text-base-content', line));
      }
    }
    return { ...node, children: out };
  };
  return walk(form, true);
}

function adjustTree(node: TreeNode, plan: NonNullable<ReturnType<typeof buyBoxPlan>>): TreeNode {
  if (isBuyForm(node)) return adjustForm(node, plan);
  if (!node.children) return node;
  return {
    ...node,
    children: node.children.map((c) => (typeof c === 'string' ? c : adjustTree(c, plan))),
  };
}

/**
 * The template with its buy boxes adjusted for this buyer. Returns the SAME
 * object when there is nothing to say, which is every visitor who is not a
 * trade contact with a rule or a read-only role.
 */
export function applyAccountBuying<
  T extends { root: unknown; symbols?: Record<string, { root: unknown }> },
>(template: T, product: ProductAccountBuying): T {
  const plan = buyBoxPlan(product);
  if (!plan) return template;
  const symbols = template.symbols
    ? Object.fromEntries(
        Object.entries(template.symbols).map(([key, def]) => [
          key,
          { ...def, root: adjustTree(def.root as TreeNode, plan) },
        ])
      )
    : undefined;
  return {
    ...template,
    root: adjustTree(template.root as TreeNode, plan),
    ...(symbols ? { symbols } : {}),
  };
}
