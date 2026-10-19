// A refunded sale sends nothing to the bank (sparx persona issue 343).

import { describe, expect, it } from 'vitest';

import { leftToSettle } from './payout-net';

describe('leftToSettle', () => {
  it('is nothing for a sale refunded to the cent in parts', () => {
    // Marisol: $640.96 by card, back as $490.96 and $150.00.
    expect(leftToSettle(640.96, [490.96, 150])).toBe(0);
    expect(leftToSettle('640.96', ['490.96', '150.00'])).toBe(0);
  });

  it('is the rest of a sale refunded in part', () => {
    expect(leftToSettle(640.96, [150])).toBe(490.96);
  });

  it('is the whole sale with no refunds', () => {
    expect(leftToSettle(640.96, [])).toBe(640.96);
  });

  it('never goes below nothing', () => {
    expect(leftToSettle(100, [60, 60])).toBe(0);
  });

  it('reads a Prisma Decimal by its text', () => {
    const decimal = (text: string) => ({ toString: () => text });
    expect(leftToSettle(decimal('640.96'), [decimal('490.96'), decimal('150')])).toBe(0);
  });
});
