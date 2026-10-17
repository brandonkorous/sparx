import { describe, expect, it } from 'vitest';
import { availableTitle, spokenForReason } from './transfer-availability';

describe('what a transfer can take', () => {
  it('says none is free instead of a count below zero', () => {
    const level = { onHand: 11, allocated: 40, available: -29 };
    expect(availableTitle(level, 'Warehouse')).toBe('None free at Warehouse');
    expect(spokenForReason(level)).toBe(
      '11 are on the shelf, and orders not yet shipped and baskets still open hold 40: 29 more than you have. A transfer can only take what is free.'
    );
  });

  it('counts what is free when some is', () => {
    const level = { onHand: 1200, allocated: 200, available: 1000 };
    expect(availableTitle(level, 'Shop')).toBe('1,000 available at Shop');
    expect(spokenForReason(level)).toBe(
      '1,200 are on the shelf, but 200 are held for orders not yet shipped and baskets still open. A transfer can only take what is free.'
    );
  });

  it('gives no reason when nothing is spoken for', () => {
    expect(spokenForReason({ onHand: 5, allocated: 0, available: 5 })).toBeNull();
  });
});
