// How many there are, when the number is part of a decision.
//
// The replacement picker on a swap shows this beside each version, because the
// question a customer usually asks is "a size up in Oat IF you have one" and the
// screen that asked which one to send used to show price and code and no count.
// A shop owner made that call from memory and got it wrong while six sat on the
// shelf (persona issue 450).
//
// The subtlety is the third state. A version nobody has ever counted is UNTRACKED,
// not zero — the shop sells it without limit — so drawing "none left" over it
// would invent a measurement nobody took, which is the same mistake as the band
// that told a shop to count its memberships (issues 444, 446).
//
// The subtlety after that is WHOSE records the note speaks for. The counts come
// from one product-filtered read, so a picker listing the whole catalog draws
// rows they cannot answer for, and the first version of this badged every one of
// them "Not counted" (issue 451).

import { describe, expect, it } from 'vitest';

import { sellable, stockNoteFor, stockNoteKind } from './products-data';

describe('stockNoteKind', () => {
  it('says NOT COUNTED when nobody ever counted it', () => {
    // Absent from the map, not zero in the map. The whole distinction.
    expect(stockNoteKind(undefined)).toBe('uncounted');
  });

  it('says NONE LEFT only for a counted zero', () => {
    expect(stockNoteKind(0)).toBe('none');
  });

  it('treats a negative as none left rather than showing a minus to a shop owner', () => {
    // Oversold is possible on a backorder policy, and "-2 to sell" is not a
    // sentence anybody should read while deciding what to post.
    expect(stockNoteKind(-2)).toBe('none');
  });

  it('gives the number when there is one', () => {
    expect(stockNoteKind(1)).toBe('some');
    expect(stockNoteKind(6)).toBe('some');
  });
});

describe('sellable', () => {
  const level = (over: Partial<Parameters<typeof sellable>[0]>) =>
    ({ onHand: 0, allocated: 0, safetyBuffer: 0, ...over }) as Parameters<typeof sellable>[0];

  it('takes off what is already spoken for AND what is held back', () => {
    // Not `available`, which is the API's on-hand-minus-allocated and stops
    // there. A buffered level's `available` is a number nobody can reach.
    expect(sellable(level({ onHand: 10, allocated: 2, safetyBuffer: 3 }))).toBe(5);
  });

  it('never goes below zero, so no screen ever shows a negative', () => {
    expect(sellable(level({ onHand: 1, allocated: 4 }))).toBe(0);
  });
});

describe('stockNoteFor', () => {
  const KNIT = 'p-marlow-knit';
  const TOTE = 'p-canvas-tote';
  const stock = {
    productId: KNIT,
    counts: new Map([
      ['v-l-oat', 6],
      ['v-l-moss', 0],
    ]),
  };

  it('says nothing about a product these counts do not cover', () => {
    // The read was `product_id=marlow-knit`. It has no opinion on a tote, and
    // "Not counted" is an opinion — it is a claim about the shop's records.
    // Saying it here badged every other row in the catalog (issue 451).
    expect(stockNoteFor({ id: 'v-tote-natural', productId: TOTE }, stock)).toBeNull();
  });

  it('says nothing at all when nothing was asked', () => {
    // A return line with no product behind it: hand-typed, or a product since
    // deleted. No question was asked, so no answer is drawn.
    expect(stockNoteFor({ id: 'v-l-oat', productId: KNIT }, undefined)).toBeNull();
  });

  it('says NOT COUNTED for a version of the covered product with no level row', () => {
    // Inside the product we DID ask about, absent really does mean untracked.
    expect(stockNoteFor({ id: 'v-xs-oat', productId: KNIT }, stock)).toEqual({
      kind: 'uncounted',
    });
  });

  it('says NONE LEFT for a counted zero, so nobody promises it to a customer', () => {
    expect(stockNoteFor({ id: 'v-l-moss', productId: KNIT }, stock)).toEqual({ kind: 'none' });
  });

  it('carries the number through when there is one', () => {
    expect(stockNoteFor({ id: 'v-l-oat', productId: KNIT }, stock)).toEqual({
      kind: 'some',
      count: 6,
    });
  });
});
