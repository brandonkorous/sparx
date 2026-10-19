// Sparx persona issue 353: the consoles read the server's answer to "did a
// gateway take this?", not lists of their own.

import { describe, expect, it } from 'vitest';

import { withByGateway } from './payment-rows';

describe('withByGateway', () => {
  it('marks the payments a gateway took', () => {
    const rows = withByGateway([
      { id: 'a', processor: 'sparx_pay' },
      { id: 'b', processor: 'stripe' },
      { id: 'c', processor: 'stripe_direct' },
    ]);
    expect(rows.map((row) => row.byGateway)).toEqual([true, true, true]);
  });

  it('marks money taken by hand, a card on the shop reader among it', () => {
    const rows = withByGateway(
      ['manual', 'card', 'check', 'ach', 'wire', 'gift_card'].map((processor) => ({ processor }))
    );
    expect(rows.every((row) => !row.byGateway)).toBe(true);
  });

  it('keeps every other field', () => {
    expect(withByGateway([{ id: 'p1', processor: 'manual', amount: 12 }])[0]).toEqual({
      id: 'p1',
      processor: 'manual',
      amount: 12,
      byGateway: false,
    });
  });
});
