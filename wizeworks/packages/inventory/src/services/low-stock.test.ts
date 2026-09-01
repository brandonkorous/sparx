// The one definition of "running low", which five surfaces used to disagree
// about. It had no test, and the arithmetic is the sort that reads correct while
// being wrong by one term.
//
// The SQL twin cannot be exercised without a database, so these cover the JS
// half. Keeping them in lockstep is still a human job — see the module header.

import { describe, expect, it } from 'vitest';
import { isLowStock, isOutOfStock } from './low-stock';

const level = (over: Partial<Parameters<typeof isLowStock>[0]> = {}) => ({
  onHand: 10,
  allocated: 0,
  safetyBuffer: 0,
  unsellableOnHand: 0,
  reorderPoint: null,
  ...over,
});

describe('a level with no reorder point is never low', () => {
  it('stays quiet at zero, because nobody asked for a trigger', () => {
    // Deliberate: an owner who set no threshold asked for no alert. It can still
    // be OUT, which is a fact rather than a judgement.
    expect(isLowStock(level({ onHand: 0 }))).toBe(false);
    expect(isOutOfStock(level({ onHand: 0 }))).toBe(true);
  });
});

describe('the threshold is inclusive', () => {
  it('is low AT the reorder point, not one below it', () => {
    expect(isLowStock(level({ onHand: 3, reorderPoint: 3 }))).toBe(true);
    expect(isLowStock(level({ onHand: 4, reorderPoint: 3 }))).toBe(false);
  });
});

describe('zero on hand with a reorder point is BOTH low and out', () => {
  // The case that drives a "Last chance" collection, and the one that reads
  // wrong at a glance: it is tempting to assume "low" means "some left". It does
  // not, and it must not — a size that has just run out is exactly what a
  // last-chance shelf and a reorder alert are both for.
  const l = level({ onHand: 0, reorderPoint: 2 });

  it('is low', () => {
    expect(isLowStock(l)).toBe(true);
  });

  it('is also out, and the two are not exclusive', () => {
    expect(isOutOfStock(l)).toBe(true);
  });
});

describe('every term comes out before the comparison', () => {
  it('counts allocated units as gone', () => {
    // 10 on hand, 8 already spoken for, so 2 sellable against a point of 2.
    expect(isLowStock(level({ onHand: 10, allocated: 8, reorderPoint: 2 }))).toBe(true);
    expect(isLowStock(level({ onHand: 10, allocated: 7, reorderPoint: 2 }))).toBe(false);
  });

  it('counts the safety buffer as withheld', () => {
    // The buffer is why `available` (on_hand - allocated) is the wrong input:
    // those units are deliberately unreachable by any shopper.
    expect(isLowStock(level({ onHand: 5, safetyBuffer: 3, reorderPoint: 2 }))).toBe(true);
    expect(isLowStock(level({ onHand: 6, safetyBuffer: 3, reorderPoint: 2 }))).toBe(false);
  });

  it('counts quarantined units as unsellable', () => {
    // Without this term, routing a returned item to the damaged shelf moves it
    // on a screen and leaves it on sale.
    expect(isLowStock(level({ onHand: 5, unsellableOnHand: 3, reorderPoint: 2 }))).toBe(true);
  });

  it('treats a missing unsellable count as zero rather than throwing', () => {
    const { unsellableOnHand: _drop, ...without } = level({ onHand: 3, reorderPoint: 2 });
    expect(isLowStock(without)).toBe(false);
  });
});

describe('an oversold level is out, not merely low', () => {
  it('uses the unclamped arithmetic, so negative counts as out', () => {
    expect(isOutOfStock(level({ onHand: 2, allocated: 5 }))).toBe(true);
    expect(isLowStock(level({ onHand: 2, allocated: 5, reorderPoint: 1 }))).toBe(true);
  });
});
