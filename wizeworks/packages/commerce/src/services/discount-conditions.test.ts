// A discount's conditions have to be the offer, not a note beside it.
//
// They were stored, edited in the console and shown back, and NOTHING read
// them. `redeemCode` checked only the date window and the usage limits, then
// took the percentage off the whole cart. A shop set "minimum spend $100",
// a shopper with $42 in the basket typed the code, it was accepted, and a
// $6.30 saving was recorded against an order that charged full price.

import { describe, expect, it } from 'vitest';
import type { DiscountCondition } from '@wizeworks/commerce-schemas';

import { eligibleBaseCents, refusalReason, type CartFacts } from './discount-conditions';

const TEE = 'p-tee';
const DRESS = 'p-dress';
const CORE_RANGE = 'c-core';

function facts(overrides: Partial<CartFacts> = {}): CartFacts {
  const lines = overrides.lines ?? [{ productId: TEE, quantity: 1, subtotalCents: 4200 }];
  return {
    lines,
    subtotalCents: lines.reduce((sum, l) => sum + l.subtotalCents, 0),
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
    customerId: 'cust-1',
    channel: 'storefront',
    collectionsByProduct: new Map(),
    hasOrderedBefore: null,
    segmentIds: new Set(),
    b2bAccountIds: new Set(),
    ...overrides,
  };
}

const MIN_100: DiscountCondition = { kind: 'min_subtotal_cents', value: 10000 };
const CORE_ONLY: DiscountCondition = { kind: 'collection_in', value: [CORE_RANGE] };

describe('a basket that does not qualify is refused', () => {
  it('refuses under the minimum spend, and says how much more is needed', () => {
    const reason = refusalReason([MIN_100], facts());

    // The exact sentence matters: this is what the shopper reads.
    expect(reason).toBe('This code needs a basket of at least $100.00. Add $58.00 more to use it.');
  });

  it('allows a basket that reaches the minimum', () => {
    const big = facts({ lines: [{ productId: TEE, quantity: 3, subtotalCents: 12600 }] });
    expect(refusalReason([MIN_100], big)).toBeNull();
  });

  it('refuses when nothing in the basket is in the offer', () => {
    const onlyDress = facts({
      lines: [{ productId: DRESS, quantity: 1, subtotalCents: 14500 }],
      collectionsByProduct: new Map([[DRESS, new Set(['c-new-in'])]]),
    });

    expect(refusalReason([CORE_ONLY], onlyDress)).toBe(
      'This code does not apply to anything in your basket.'
    );
  });

  it('allows the basket when one line is in the offer', () => {
    const mixed = facts({
      lines: [
        { productId: TEE, quantity: 1, subtotalCents: 4200 },
        { productId: DRESS, quantity: 1, subtotalCents: 14500 },
      ],
      collectionsByProduct: new Map([[TEE, new Set([CORE_RANGE])]]),
    });

    expect(refusalReason([CORE_ONLY], mixed)).toBeNull();
  });

  it('refuses a repeat buyer on a first-order-only code, and nobody else', () => {
    const first: DiscountCondition = { kind: 'first_order_only', value: true };

    expect(refusalReason([first], facts({ hasOrderedBefore: true }))).toBe(
      'This code is for a first order only.'
    );
    expect(refusalReason([first], facts({ hasOrderedBefore: false }))).toBeNull();
    // Unknown must not read as "has ordered" — that would refuse a guest who
    // has never bought anything.
    expect(refusalReason([first], facts({ hasOrderedBefore: null }))).toBeNull();
  });

  it('refuses too few items, counting quantity rather than lines', () => {
    const three: DiscountCondition = { kind: 'min_item_count', value: 3 };
    const twoOfOne = facts({ lines: [{ productId: TEE, quantity: 2, subtotalCents: 8400 }] });

    expect(refusalReason([three], twoOfOne)).toBe(
      'This code needs at least 3 items in your basket.'
    );
    const threeOfOne = facts({ lines: [{ productId: TEE, quantity: 3, subtotalCents: 12600 }] });
    expect(refusalReason([three], threeOfOne)).toBeNull();
  });

  it('has nothing to say about a code with no conditions', () => {
    expect(refusalReason([], facts())).toBeNull();
  });
});

describe('the saving comes off what the offer covers', () => {
  const mixed = facts({
    lines: [
      { productId: TEE, quantity: 1, subtotalCents: 4200 },
      { productId: DRESS, quantity: 1, subtotalCents: 14500 },
    ],
    collectionsByProduct: new Map([[TEE, new Set([CORE_RANGE])]]),
  });

  it('takes an unrestricted offer off the whole basket', () => {
    expect(eligibleBaseCents([], mixed)).toBe(18700);
  });

  it('takes a collection offer off only that collection', () => {
    // The whole point: 15% of $187.00 would quietly discount the dress too.
    expect(eligibleBaseCents([CORE_ONLY], mixed)).toBe(4200);
  });

  it('takes a product offer off only that product', () => {
    const byProduct: DiscountCondition = { kind: 'product_in', value: [DRESS] };
    expect(eligibleBaseCents([byProduct], mixed)).toBe(14500);
  });

  it('treats two restrictions as an OR', () => {
    const byProduct: DiscountCondition = { kind: 'product_in', value: [DRESS] };
    expect(eligibleBaseCents([CORE_ONLY, byProduct], mixed)).toBe(18700);
  });
});
