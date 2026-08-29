// A discount's conditions have to be the offer, not a note beside it.
//
// They were stored, edited in the console and shown back, and NOTHING read
// them. `redeemCode` checked only the date window and the usage limits, then
// took the percentage off the whole cart. A shop set "minimum spend $100",
// a shopper with $42 in the basket typed the code, it was accepted, and a
// $6.30 saving was recorded against an order that charged full price.

import { describe, expect, it } from 'vitest';
import type { DiscountCondition } from '@wizeworks/commerce-schemas';

import {
  apportionToLines,
  discountWindowState,
  eligibleBaseCents,
  isDiscountRunning,
  refusalReason,
  usageBlock,
  type CartFacts,
} from './discount-conditions';

const TEE = 'p-tee';
const DRESS = 'p-dress';
const CORE_RANGE = 'c-core';

function facts(overrides: Partial<CartFacts> = {}): CartFacts {
  const lines = overrides.lines ?? [
    { id: 'l-tee', productId: TEE, quantity: 1, subtotalCents: 4200 },
  ];
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
    const big = facts({
      lines: [{ id: 'l-tee', productId: TEE, quantity: 3, subtotalCents: 12600 }],
    });
    expect(refusalReason([MIN_100], big)).toBeNull();
  });

  it('refuses when nothing in the basket is in the offer', () => {
    const onlyDress = facts({
      lines: [{ id: 'l-dress', productId: DRESS, quantity: 1, subtotalCents: 14500 }],
      collectionsByProduct: new Map([[DRESS, new Set(['c-new-in'])]]),
    });

    expect(refusalReason([CORE_ONLY], onlyDress)).toBe(
      'This code does not apply to anything in your basket.'
    );
  });

  it('allows the basket when one line is in the offer', () => {
    const mixed = facts({
      lines: [
        { id: 'l-tee', productId: TEE, quantity: 1, subtotalCents: 4200 },
        { id: 'l-dress', productId: DRESS, quantity: 1, subtotalCents: 14500 },
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
    const twoOfOne = facts({
      lines: [{ id: 'l-tee', productId: TEE, quantity: 2, subtotalCents: 8400 }],
    });

    expect(refusalReason([three], twoOfOne)).toBe(
      'This code needs at least 3 items in your basket.'
    );
    const threeOfOne = facts({
      lines: [{ id: 'l-tee', productId: TEE, quantity: 3, subtotalCents: 12600 }],
    });
    expect(refusalReason([three], threeOfOne)).toBeNull();
  });

  it('has nothing to say about a code with no conditions', () => {
    expect(refusalReason([], facts())).toBeNull();
  });
});

describe('the saving comes off what the offer covers', () => {
  const mixed = facts({
    lines: [
      { id: 'l-tee', productId: TEE, quantity: 1, subtotalCents: 4200 },
      { id: 'l-dress', productId: DRESS, quantity: 1, subtotalCents: 14500 },
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

describe('the saving is split across the lines that earned it', () => {
  const mixed = facts({
    lines: [
      { id: 'l-tee', productId: TEE, quantity: 1, subtotalCents: 4200 },
      { id: 'l-dress', productId: DRESS, quantity: 1, subtotalCents: 14500 },
    ],
    collectionsByProduct: new Map([[TEE, new Set([CORE_RANGE])]]),
  });

  it('puts a restricted offer entirely on the line it covers', () => {
    const shares = apportionToLines([CORE_ONLY], mixed, 630);

    expect(shares.get('l-tee')).toBe(630);
    expect(shares.has('l-dress')).toBe(false);
  });

  it('splits an unrestricted offer in proportion to what each line cost', () => {
    // 15% of $187.00 = $28.05, which is 15% of each line to the cent.
    const shares = apportionToLines([], mixed, 2805);

    expect(shares.get('l-tee')).toBe(630);
    expect(shares.get('l-dress')).toBe(2175);
  });

  it('never loses or invents a cent to rounding', () => {
    // $10.00 over three lines is 333.33 each — somebody has to get the extra.
    const thirds = facts({
      lines: [
        { id: 'a', productId: TEE, quantity: 1, subtotalCents: 1000 },
        { id: 'b', productId: TEE, quantity: 1, subtotalCents: 1000 },
        { id: 'c', productId: TEE, quantity: 1, subtotalCents: 1000 },
      ],
    });

    const shares = apportionToLines([], thirds, 1000);

    expect([...shares.values()].reduce((sum, cents) => sum + cents, 0)).toBe(1000);
    expect([...shares.values()].sort()).toEqual([333, 333, 334]);
  });

  it('keeps the money on the order when nothing in the basket qualifies', () => {
    // A saving stored against a basket since re-priced. Dropping it would make
    // the order total disagree with the header it was quoted at.
    const onlyDress = facts({
      lines: [{ id: 'l-dress', productId: DRESS, quantity: 1, subtotalCents: 14500 }],
      collectionsByProduct: new Map(),
    });

    const shares = apportionToLines([CORE_ONLY], onlyDress, 630);

    expect(shares.get('l-dress')).toBe(630);
  });

  it('has nothing to split when the offer was worth nothing', () => {
    expect(apportionToLines([], mixed, 0).size).toBe(0);
  });
});

describe('an offer stops being given away when it runs out', () => {
  const offer = { perCustomerLimit: 1, totalUsageLimit: null, usageCount: 4 };

  it('lets a shopper who has not used it through', () => {
    expect(usageBlock(offer, 0)).toBeNull();
  });

  it('stops a shopper who has spent their allowance', () => {
    expect(usageBlock(offer, 1)).toBe('customer');
  });

  it('says which limit was hit, because they are two different sentences', () => {
    expect(usageBlock({ ...offer, totalUsageLimit: 4 }, 0)).toBe('total');
  });

  it('checks only the shop-wide limit for a basket with nobody on it', () => {
    // A guest has no usage rows to count, and null says so rather than
    // standing in for zero — the shop-wide limit still applies to them.
    expect(usageBlock(offer, null)).toBeNull();
    expect(usageBlock({ ...offer, totalUsageLimit: 4 }, null)).toBe('total');
  });

  it('is asked by the basket as well as by the code box', () => {
    // The point of the rule living here. It used to sit inside assertUsageLimit,
    // which runs when a code is TYPED and never again, so a basket kept a saving
    // its owner had already spent and carried it through checkout while the box
    // beside it refused the same code (issue 312).
    expect(usageBlock(offer, 1)).not.toBeNull();
  });
});

describe('an offer stops being given away when it stops running', () => {
  // The sale Devi actually ran, to the minute: it ended at 22:21 and a basket
  // was still being checked out against it at 23:23 (issue 300).
  const ENDED = new Date('2026-08-28T05:21:00Z');
  const DURING = new Date('2026-08-28T05:20:00Z');
  const AFTER = new Date('2026-08-28T06:23:00Z');

  const sale = (
    over: Partial<{
      status: string;
      startAt: Date | null;
      endAt: Date | null;
      deletedAt: Date | null;
    }> = {}
  ) => ({
    status: 'active',
    startAt: null,
    endAt: ENDED,
    deletedAt: null,
    ...over,
  });

  it('is running in the last minute before it ends', () => {
    expect(discountWindowState(sale(), DURING)).toBe('running');
    expect(isDiscountRunning(sale(), DURING)).toBe(true);
  });

  it('is over an hour after it ends', () => {
    expect(discountWindowState(sale(), AFTER)).toBe('after');
    expect(isDiscountRunning(sale(), AFTER)).toBe(false);
  });

  it('has not started before its start date', () => {
    const later = sale({ startAt: AFTER, endAt: null });
    expect(discountWindowState(later, DURING)).toBe('before');
    expect(isDiscountRunning(later, DURING)).toBe(false);
  });

  it('runs forever when it was given no dates at all', () => {
    const open = sale({ endAt: null });
    expect(discountWindowState(open, AFTER)).toBe('running');
    expect(isDiscountRunning(open, AFTER)).toBe(true);
  });

  it('is not running once it has been retired or deleted, dates or no dates', () => {
    const open = { startAt: null, endAt: null, deletedAt: null };
    expect(isDiscountRunning({ ...open, status: 'retired' }, DURING)).toBe(false);
    expect(isDiscountRunning({ ...open, status: 'active', deletedAt: ENDED }, DURING)).toBe(false);
  });
});
