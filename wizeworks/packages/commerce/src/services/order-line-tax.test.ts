// Each order line carries the tax the checkout quoted for it (sparx persona
// issue 226): Renée's Stanadyne additive, $12.50 at Utah's 7.25%, was $0.91 of
// tax on the order and $0.00 on its line, so her invoice could not list it.

import { describe, expect, it } from 'vitest';

import { quotedRateBasisPoints, taxByCartItem } from './order-line-tax';

const ADDITIVE = '5d2a3f1e-0c4b-4a7e-9f1d-2b6c8e9a1f00';
const RAILS = '7e1b9c2d-3f4a-4b5c-8d6e-0a1b2c3d4e5f';

const quote = (lines: object[], shippingTaxCents = 0) => ({
  providerSlug: 'sparx-manual',
  totalTaxCents: 0,
  shippingTaxCents,
  lines,
});

describe('taxByCartItem', () => {
  it('gives each basket line the tax quoted for it', () => {
    const map = taxByCartItem(
      quote([
        { lineRef: 0, cartItemId: ADDITIVE, taxAmountCents: 91, taxableAmountCents: 1250 },
        { lineRef: 1, cartItemId: RAILS, taxAmountCents: 13698, taxableAmountCents: 188940 },
      ]),
      13789
    );
    expect(map.get(ADDITIVE)).toBe(91);
    expect(map.get(RAILS)).toBe(13698);
  });

  it('counts tax on the shipping toward the session total, not toward a line', () => {
    const map = taxByCartItem(
      quote([{ lineRef: 0, cartItemId: ADDITIVE, taxAmountCents: 91 }], 109),
      200
    );
    expect(map.get(ADDITIVE)).toBe(91);
  });

  it('hands out nothing when the lines do not come to the tax charged', () => {
    expect(
      taxByCartItem(quote([{ lineRef: 0, cartItemId: ADDITIVE, taxAmountCents: 91 }]), 92).size
    ).toBe(0);
  });

  it('hands out nothing for a quote taken before lines named their basket line', () => {
    expect(taxByCartItem(quote([{ lineRef: 0, taxAmountCents: 91 }]), 91).size).toBe(0);
  });

  it('hands out nothing when there is no quote', () => {
    expect(taxByCartItem(null, 0).size).toBe(0);
    expect(taxByCartItem({}, 0).size).toBe(0);
  });
});

// The invoice printed "Tax (7.24%)": the order kept the tax in cents and not the
// rate, so the invoice divided one by the other. Utah's rate is 7.25%, and the
// checkout quoted 725 basis points (sparx persona issue 228).
describe('quotedRateBasisPoints', () => {
  const utah = (taxAmountCents: number, rateBasisPoints = 725) => ({
    lineRef: 0,
    taxAmountCents,
    jurisdictions: [{ name: 'Utah sales tax', type: 'state', rateBasisPoints, amountCents: 0 }],
  });

  it('is the rate the checkout charged', () => {
    expect(quotedRateBasisPoints(quote([utah(181), utah(91)]))).toBe(725);
  });

  it('adds up a state and a city on the same line', () => {
    const line = {
      lineRef: 0,
      taxAmountCents: 200,
      jurisdictions: [
        { name: 'State', type: 'state', rateBasisPoints: 485, amountCents: 0 },
        { name: 'City', type: 'city', rateBasisPoints: 240, amountCents: 0 },
      ],
    };
    expect(quotedRateBasisPoints(quote([line]))).toBe(725);
  });

  it('leaves an exempt line out', () => {
    expect(quotedRateBasisPoints(quote([utah(181), utah(0, 0)]))).toBe(725);
  });

  it('is unknown when two lines were taxed at different rates', () => {
    expect(quotedRateBasisPoints(quote([utah(181), utah(90, 600)]))).toBeNull();
  });

  it('is unknown when nothing was taxed, or there is no quote', () => {
    expect(quotedRateBasisPoints(quote([utah(0, 0)]))).toBeNull();
    expect(quotedRateBasisPoints(null)).toBeNull();
    expect(quotedRateBasisPoints(quote([{ lineRef: 0, taxAmountCents: 181 }]))).toBeNull();
  });
});
