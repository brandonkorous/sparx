// MEASURED 2026-10-03 on Gillett Diesel: a CP4 kit with one on the shop's shelf
// was refused to a buyer asking for more, and the shop said "Sorry, this item
// just sold out." while the product page beside it still offered the one.

import { describe, expect, it } from 'vitest';

import { stockRefusalOf, stockRefusalSentence } from './stock-refusal-words';

const refusal = (available: unknown, requested: unknown = 7) => ({
  success: false,
  error: { code: 'OUT_OF_STOCK', message: 'Not enough.', details: { requested, available } },
});

describe('a basket refused for stock', () => {
  it('says how many are left when some are, never "sold out"', () => {
    const sentence = stockRefusalSentence(stockRefusalOf(refusal(1)));
    expect(sentence).toBe(
      'Sorry, only 1 is left to buy, counting any already in your basket. Lower the quantity and try again.'
    );
    expect(sentence).not.toContain('sold out');
  });

  it('agrees in number', () => {
    expect(stockRefusalSentence(stockRefusalOf(refusal(4)))).toContain('only 4 are left');
  });

  it('says sold out only when nothing is left', () => {
    expect(stockRefusalSentence(stockRefusalOf(refusal(0)))).toBe(
      'Sorry, this item just sold out.'
    );
  });

  it('reads only a stock refusal', () => {
    expect(stockRefusalOf({ error: { code: 'CONFLICT', details: { available: 3 } } })).toBeNull();
    expect(stockRefusalOf(null)).toBeNull();
    expect(stockRefusalOf(refusal('lots'))).toBeNull();
  });
});
