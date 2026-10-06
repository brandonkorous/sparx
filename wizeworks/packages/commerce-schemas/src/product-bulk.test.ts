import { describe, expect, it } from 'vitest';

import { FitmentRangeValue } from './fitment';
import { BulkAddFitmentInput, ProductSelection } from './product-bulk';

/**
 * Issue 065: the bulk writes take a selection, and a year window may be open at
 * one end. The server reads an open end back as `null`, so `null` has to be
 * accepted on the way in or an add that resends what a product already fits
 * fails on the first open-ended window.
 */

const P1 = '10000000-0000-4000-8000-000000000001';
const DOMAIN = 'd0000000-0000-4000-8000-000000000001';

describe('FitmentRangeValue', () => {
  it('accepts an open end written as null', () => {
    expect(
      FitmentRangeValue.safeParse({ dimensionKey: 'year', min: null, max: 2019 }).success
    ).toBe(true);
  });

  it('still refuses a window with neither end', () => {
    expect(
      FitmentRangeValue.safeParse({ dimensionKey: 'year', min: null, max: null }).success
    ).toBe(false);
  });

  it('still refuses a window that ends before it starts', () => {
    expect(
      FitmentRangeValue.safeParse({ dimensionKey: 'year', min: 2023, max: 2017 }).success
    ).toBe(false);
  });
});

describe('ProductSelection', () => {
  it('takes ids or the list narrowing, never both and never neither', () => {
    expect(ProductSelection.safeParse({ productIds: [P1] }).success).toBe(true);
    expect(ProductSelection.safeParse({ match: { productType: 'Fuel System' } }).success).toBe(
      true
    );
    expect(ProductSelection.safeParse({ productIds: [P1], match: {} }).success).toBe(false);
    expect(ProductSelection.safeParse({}).success).toBe(false);
  });
});

describe('BulkAddFitmentInput', () => {
  it('needs at least one rule', () => {
    expect(
      BulkAddFitmentInput.safeParse({ selection: { productIds: [P1] }, fitments: [] }).success
    ).toBe(false);
    expect(
      BulkAddFitmentInput.safeParse({
        selection: { productIds: [P1] },
        fitments: [{ domainId: DOMAIN, nodeId: null }],
      }).success
    ).toBe(true);
  });
});
