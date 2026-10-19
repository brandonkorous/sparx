// A refund that gives back the last of the money makes the order refunded
// (sparx persona issue 341).

import { describe, expect, it } from 'vitest';

import { refundCoversWhatIsLeft } from './refund-covers';

describe('refundCoversWhatIsLeft', () => {
  it('counts the last cents of a split refund as the whole', () => {
    // Marisol: $490.96 for the part, then $150.00 for its core deposit.
    expect(refundCoversWhatIsLeft(150, 640.96, 490.96)).toBe(true);
    expect(refundCoversWhatIsLeft('150.00', '640.96', '490.96')).toBe(true);
  });

  it('is true for a single refund of the whole order', () => {
    expect(refundCoversWhatIsLeft(640.96, 640.96, 0)).toBe(true);
  });

  it('is false while money is still left on the order', () => {
    expect(refundCoversWhatIsLeft(490.96, 640.96, 0)).toBe(false);
    expect(refundCoversWhatIsLeft(149.99, 640.96, 490.96)).toBe(false);
  });

  it('reads a Prisma Decimal by its text', () => {
    const decimal = (text: string) => ({ toString: () => text });
    expect(refundCoversWhatIsLeft(decimal('150'), decimal('640.96'), decimal('490.96'))).toBe(true);
  });
});
