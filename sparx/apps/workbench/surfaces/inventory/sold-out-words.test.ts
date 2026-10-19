import { describe, expect, it } from 'vitest';
import { soldOutBody } from './sold-out-words';

describe('why nothing is left to sell', () => {
  it('says counting in brings it back when the shelf is empty', () => {
    expect(soldOutBody([{ onHand: 0, allocated: 0 }])).toMatch(
      /comes back on sale by itself the moment you count some in\.$/
    );
  });

  it('says the orders come first when they want more than the shelf holds', () => {
    expect(soldOutBody([{ onHand: 11, allocated: 40 }])).toBe(
      'Your website shows it as sold out and will not take an order for it. Orders not yet shipped and baskets still open hold 29 more than you have, so those come first and it comes back on sale once more arrive than that.'
    );
  });

  it('says the shelf is taken when units are there but none is free', () => {
    expect(soldOutBody([{ onHand: 4, allocated: 4 }])).toMatch(/spoken for or held back/);
  });
});
