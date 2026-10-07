// What a service costs, in the console's words (sparx persona issue 117): a
// turbo rebuild priced by quote must not read "Free".

import { describe, expect, it } from 'vitest';

import { servicePriceLabel, servicePriceSuffix } from './setup-data';

describe('servicePriceLabel', () => {
  it('says Quoted for a price worked out after a look', () => {
    expect(servicePriceLabel({ priceCents: 0, currency: 'usd', priceOnQuote: true })).toBe(
      'Quoted'
    );
    expect(servicePriceSuffix({ priceCents: 0, currency: 'usd', priceOnQuote: true })).toBe(
      ' · Quoted'
    );
  });

  it('says Free only for a free service, and the price otherwise', () => {
    expect(servicePriceLabel({ priceCents: 0, currency: 'usd' })).toBe('Free');
    expect(servicePriceSuffix({ priceCents: 0, currency: 'usd' })).toBe('');
    expect(servicePriceLabel({ priceCents: 19500, currency: 'usd' })).toBe('$195.00');
  });
});
