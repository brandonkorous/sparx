// Sparx persona issue 362: a buyer of the dry-filter intake had S&B emailed the
// oiled one's code, at the one price the whole product was given.

import { describe, expect, it } from 'vitest';

import { handVersionsOf, handVersionsToStore, supplierLineFor } from '@wizeworks/dropship';

const versions = [
  { variantId: 'oiled', supplierSku: '75-5094', costPriceCents: 25000 },
  { variantId: 'dry', supplierSku: '75-5094D', costPriceCents: 26200 },
];
const link = { supplierSku: '75-5094', costPriceCents: 25000, versions };

describe('supplierLineFor', () => {
  it('sends the code and price of the version that was bought', () => {
    expect(supplierLineFor({ variantId: 'dry', sku: '75-5094D', costCents: null }, link)).toEqual({
      supplierSku: '75-5094D',
      unitCostCents: 26200,
    });
  });

  it('uses the product one code and price when it has no versions of its own', () => {
    expect(
      supplierLineFor(
        { variantId: 'tank', sku: '10-1008', costCents: null },
        { supplierSku: '10-1008', costPriceCents: 110000, versions: [] }
      )
    ).toEqual({ supplierSku: '10-1008', unitCostCents: 110000 });
  });

  it('falls back to the line own code and cost with no link', () => {
    expect(supplierLineFor({ variantId: null, sku: 'X-1', costCents: 500 }, undefined)).toEqual({
      supplierSku: 'X-1',
      unitCostCents: 500,
    });
  });
});

describe('handVersionsOf', () => {
  it('reads back what was stored, and nothing of an imported item', () => {
    const stored = handVersionsToStore(versions, (id) => (id === 'dry' ? 'Dry' : 'Oiled'));
    expect(handVersionsOf(stored)).toEqual(versions);
    expect(
      handVersionsOf([{ supplierSku: 'abc', title: 'Red', options: {}, costPriceCents: 100 }])
    ).toEqual([]);
    expect(handVersionsOf(null)).toEqual([]);
  });
});
