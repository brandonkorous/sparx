// The words under "Cost to you" are true of the line (sparx persona issue 086):
// "From the product" showed over an empty box on parts with no cost on file.

import { describe, expect, it } from 'vitest';
import { costHelp } from './cost-help';

const base = { markupMode: false, productId: null, cost: '', productCost: null };

describe('costHelp', () => {
  it('says a product with no cost on file has none, and what to do', () => {
    expect(costHelp({ ...base, productId: 'p1', productCost: '' })).toBe(
      'This product has no cost on file. Type what it cost you to see your margin.'
    );
  });

  it('says so for a reopened line whose product has no cost on file', () => {
    // Saved, the server fills a product's cost, so empty means it has none.
    expect(costHelp({ ...base, productId: 'p1' })).toBe(
      'This product has no cost on file. Type what it cost you to see your margin.'
    );
  });

  it('says the cost came from the product only while it did', () => {
    const fromProduct = { ...base, productId: 'p1', productCost: '412.5', cost: '412.5' };
    expect(costHelp(fromProduct)).toBe(
      'From the product. Change it if this one cost you more or less. Only you see it.'
    );
    expect(costHelp({ ...fromProduct, cost: '400' })).toBe(
      'Only you see it. Your margin is worked out from it.'
    );
  });

  it('does not claim a reopened line cost came from the product', () => {
    expect(costHelp({ ...base, productId: 'p1', cost: '412.5' })).toBe(
      'Only you see it. Your margin is worked out from it.'
    );
  });

  it('keeps the plain words for a line with no product', () => {
    expect(costHelp(base)).toBe('Optional. Only you see it. Your margin is worked out from it.');
  });

  it('says a markup line is priced from it', () => {
    expect(costHelp({ ...base, markupMode: true, productId: 'p1' })).toBe(
      'What it cost you. The price is worked out from this.'
    );
  });
});
