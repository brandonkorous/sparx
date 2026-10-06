import { describe, expect, it } from 'vitest';
import { addToCartForm, buyBox } from '@wizeworks/silica-catalog';

import { checkoutBlock, ruleSentence, snapQuantity, type BuyingRule } from './account-buying-rules';
import { applyAccountBuying, buyBoxPlan } from './buying-rules-tree';

// The buy box a tenant's product page actually renders is a published silica
// tree, stamped from `buyBox()`. These run the REAL factory nodes through the
// adjustment, so a change to the stamped markup cannot quietly stop the rules
// reaching the page (sparx persona issue 086).

const CASE_OF_12: BuyingRule = {
  minimum: 24,
  maximum: 96,
  caseOf: 12,
  start: 24,
  step: 12,
  words: ['Sold in cases of 12', 'Minimum 24', 'Up to 96 per order'],
};

const product = (over: Partial<Parameters<typeof buyBoxPlan>[0]> = {}) => ({
  accountOrdering: { accountName: 'Wasatch Fleet Services', canOrder: true, refusal: null },
  variants: [{ id: 'v1', sku: 'FPPF-90343', title: null, buyingRules: CASE_OF_12 }],
  ...over,
});

interface N {
  kind?: string;
  tag?: string;
  attrs?: Record<string, unknown>;
  children?: (N | string)[];
  data?: { kind?: string; ref?: string };
}

function find(node: N, test: (n: N) => boolean): N[] {
  const hits = test(node) ? [node] : [];
  for (const c of node.children ?? []) if (typeof c !== 'string') hits.push(...find(c, test));
  return hits;
}
const texts = (node: N): string[] =>
  (node.children ?? []).flatMap((c) => (typeof c === 'string' ? [c] : texts(c)));

describe('applyAccountBuying on the stamped buy box', () => {
  it('starts the quantity box at the minimum, steps by the case, and says the rule beside it', () => {
    const out = applyAccountBuying({ root: buyBox(), symbols: {} }, product());
    const [input] = find(out.root, (n) => n.tag === 'input' && n.attrs?.name === 'quantity');
    expect(input?.attrs).toMatchObject({ value: '24', min: '24', step: '12', max: '96' });
    const said = texts(out.root as N).filter((t) => t.startsWith('Sold in cases'));
    expect(said).toEqual(['Sold in cases of 12. Minimum 24. Up to 96 per order.']);
  });

  it('puts the add-to-cart form away for a view-only contact and says who can order', () => {
    const refusal = 'Your account lets you see invoices and orders. Ask Renée to place orders.';
    const out = applyAccountBuying(
      { root: addToCartForm() },
      product({
        accountOrdering: { accountName: 'Wasatch Fleet Services', canOrder: false, refusal },
      })
    );
    expect(find(out.root as N, (n) => n.tag === 'form')).toHaveLength(0);
    expect(texts(out.root as N)).toContain(refusal);
  });

  it('leaves the page exactly as published for everybody else', () => {
    const template = { root: buyBox() as unknown, symbols: {} };
    expect(
      applyAccountBuying(template, {
        accountOrdering: null,
        variants: [{ id: 'v1', sku: 'A', title: null }],
      })
    ).toBe(template);
  });

  it('names each version when their rules differ, and leaves the box alone', () => {
    const plan = buyBoxPlan(
      product({
        variants: [
          { id: 'v1', sku: 'A', title: 'Single', buyingRules: null },
          { id: 'v2', sku: 'B', title: 'Case', buyingRules: CASE_OF_12 },
        ],
      })
    );
    expect(plan?.boxRule).toBeNull();
    expect(plan?.lines).toEqual(['Case: Sold in cases of 12. Minimum 24. Up to 96 per order.']);
  });
});

describe('the cart side', () => {
  it('keeps a quantity box inside the rule', () => {
    expect(snapQuantity(CASE_OF_12, 5)).toBe(24);
    expect(snapQuantity(CASE_OF_12, 31)).toBe(36);
    expect(snapQuantity(CASE_OF_12, 200)).toBe(96);
    expect(snapQuantity(null, 3)).toBe(3);
    expect(ruleSentence(CASE_OF_12)).toBe('Sold in cases of 12. Minimum 24. Up to 96 per order.');
  });

  it('holds checkout back for the reasons the server would refuse it', () => {
    const base = {
      accountName: 'Wasatch Fleet Services',
      canOrder: true,
      orderingRefusal: null,
      lines: [],
      minimumOrderCents: 50_000,
      shortfallCents: 11_240,
      shortfallMessage: 'Add $112.40 more to reach your $500.00 minimum.',
    };
    expect(checkoutBlock(base)).toBe('Add $112.40 more to reach your $500.00 minimum.');
    expect(
      checkoutBlock({
        ...base,
        lines: [{ ...CASE_OF_12, cartItemId: 'l1', problem: 'Choose 24 or 36.' }],
      })
    ).toMatch(/One amount in your cart does not fit/);
    expect(
      checkoutBlock({ ...base, canOrder: false, orderingRefusal: 'Ask Renée to place orders.' })
    ).toBe('Ask Renée to place orders.');
    expect(checkoutBlock(null)).toBeNull();
  });
});
