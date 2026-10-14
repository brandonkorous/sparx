// Checkout chose "Collect in person" for a buyer who had asked to have it sent
// (sparx persona issue 222): the options come cheapest first, and collecting is free.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { deliveryDefault } from './delivery-default';

const here = fileURLToPath(new URL('.', import.meta.url));
const collect = {
  providerSlug: 'collection',
  rateRef: 'collection:in-person',
  service: 'Collect in person',
  carrier: 'Collection',
  amountCents: 0,
  estimatedDays: null,
};
const ups = {
  providerSlug: 'sparx-manual',
  rateRef: 'manual:ups',
  service: 'UPS Ground',
  carrier: 'UPS',
  amountCents: 1500,
  estimatedDays: 5,
};

describe('deliveryDefault', () => {
  it('chooses the first way of sending it, not collecting', () => {
    expect(deliveryDefault([collect, ups])).toBe(ups);
  });

  it('chooses collecting only when it is all there is', () => {
    expect(deliveryDefault([collect])).toBe(collect);
  });

  it('chooses nothing from nothing', () => {
    expect(deliveryDefault([])).toBeNull();
  });

  it('is what checkout chooses after quoting an address', () => {
    const flow = readFileSync(
      join(here, '..', 'components', 'checkout', 'checkout-flow.tsx'),
      'utf8'
    );
    expect(flow).toContain('setChosenRate(deliveryDefault(result.rates))');
    expect(flow).not.toContain(
      'setChosenRate(result.rates[0] ?? null);\n        if (result.rates.length === 0)'
    );
  });
});
