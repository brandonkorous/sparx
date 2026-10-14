// The sales tax on a sale at the counter (sparx persona issue 230).
//
// Doty rang up an Edge CTS3 Backup Camera, $299.95, for Brynn O'Hara-Løvdal, and
// the till asked for $299.95: Utah's 7.25% ($21.75) was never added, and the order
// was written with no tax on it. These pin the sum the till asks for, the order it
// writes, and the question it asks the server.

import { describe, expect, it } from 'vitest';

import { saleTotals } from './sale-core';
import { saleOrderBody } from './sale-order-body';
import type { SaleLine } from './sale-data';
import { taxKey, taxRowLabel, taxedLines, type SaleTaxQuote } from './sale-tax';

function line(over: Partial<SaleLine> = {}): SaleLine {
  return {
    id: 'l_camera',
    name: 'Edge CTS3 Backup Camera (98203)',
    quantity: 1,
    price: '299.95',
    sku: '98203',
    productId: 'p-camera',
    variantId: 'v-camera',
    orderAheadDays: null,
    priceTouched: false,
    ...over,
  };
}

const UTAH: SaleTaxQuote = {
  totalTaxCents: 2175,
  rateBasisPoints: 725,
  lines: [{ ref: 'l_camera', taxAmountCents: 2175 }],
  certificateOnFile: false,
};

describe('what the till asks for', () => {
  it('adds the sales tax to the total', () => {
    expect(saleTotals([line()], UTAH.totalTaxCents)).toEqual({
      goods: 299.95,
      coreDeposits: 0,
      tax: 21.75,
      total: 321.7,
    });
  });

  it('adds tax and a core deposit, and never taxes the deposit', () => {
    const injector = line({
      id: 'l_injector',
      price: '600.00',
      core: { depositCents: 15000, firstOffered: true },
    });
    // $600.00 at 7.25% is $43.50; the $150.00 deposit is not in it.
    expect(saleTotals([injector], 4350).total).toBe(793.5);
    expect(taxedLines([injector])).toEqual([
      { ref: 'l_injector', variantId: 'v-camera', quantity: 1, unitPriceCents: 60000 },
    ]);
  });
});

describe('the order it writes', () => {
  const body = saleOrderBody({
    customerId: 'c-brynn',
    currency: 'USD',
    propertyId: 'site-gillett',
    lines: [line()],
    tax: UTAH,
  });

  it('carries the tax on the line and on the order', () => {
    expect(body.items[0]?.taxAmount).toBe(21.75);
    expect(body.taxTotal).toBe(21.75);
  });

  it('keeps the rate it was charged at, for its invoice', () => {
    expect(body.metadata.taxRateBasisPoints).toBe(725);
  });

  it('is still collected at the counter', () => {
    expect(body.metadata.shippingRateRef).toBe('collection:in-person');
    expect(body.source).toBe('till');
  });
});

describe('the question', () => {
  it('is asked again when a price is typed over', () => {
    expect(taxKey('c-brynn', [line()])).not.toBe(taxKey('c-brynn', [line({ price: '254.96' })]));
  });

  it('is asked again for somebody else', () => {
    expect(taxKey('c-brynn', [line()])).not.toBe(taxKey('c-omalley', [line()]));
  });
});

describe('the row', () => {
  it('names the rate', () => {
    expect(taxRowLabel(UTAH)).toBe('Sales tax (7.25%)');
  });

  it('says why there is none for a buyer with a certificate', () => {
    expect(
      taxRowLabel({ totalTaxCents: 0, rateBasisPoints: null, lines: [], certificateOnFile: true })
    ).toBe('Sales tax (none: their tax certificate is on file)');
  });
});
