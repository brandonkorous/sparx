// What the product page tells a shopper about supply.
//
// Every tenant's product page renders through the silica `commerce.product`
// template, and this file builds the record that template binds. The legacy
// React `<ProductDetail>` says all of this too, but almost nobody reaches it, so
// for months the record decided a shopper saw nothing at all about a preorder
// while the component that did say it sat unused (issue 682).
//
// These are money sentences. A shopper reads one of them and decides to pay for
// something that is not in a box anywhere, so each one is tested for what it
// says AND for staying quiet when it has nothing honest to say.

import { describe, expect, it } from 'vitest';

import type { PublicPreorderOffer, PublicProduct, PublicProductVariant } from './commerce';
import { productToSilicaRecord } from './silica-data';

const OFFER: PublicPreorderOffer = {
  availableAt: '2027-07-01T00:00:00.000Z',
  availabilityNote: 'Strung to order by the workshop in Lyon.',
  isTakingOrders: true,
  remaining: 6,
  chargeUpFront: false,
  blockedBy: null,
};

function variant(over: Partial<PublicProductVariant> = {}): PublicProductVariant {
  return {
    id: 'var_1',
    sku: 'COLETTE-TB',
    title: null,
    priceCents: 680000,
    compareAtPriceCents: null,
    yourPriceCents: null,
    isDefault: true,
    inventoryPolicy: 'continue',
    optionValueIds: [],
    available: 0,
    inStock: true,
    preorder: null,
    expectedBackAt: null,
    ...over,
  };
}

function product(over: Partial<PublicProduct> = {}): PublicProduct {
  return {
    id: 'prod_1',
    title: 'Colette Tennis Bracelet',
    handle: 'colette-tennis-bracelet',
    description: 'An unbroken line of hand-set white diamonds.',
    vendor: null,
    productType: null,
    tags: [],
    priceMinCents: 680000,
    priceMaxCents: 680000,
    compareAtCents: null,
    yourPriceCents: null,
    inStock: true,
    averageRating: null,
    reviewCount: 0,
    primaryImageId: null,
    primaryImageAlt: null,
    defaultVariantId: 'var_1',
    seoTitle: null,
    seoDescription: null,
    updatedAt: '2026-09-18T00:00:00.000Z',
    fulfillmentType: 'shipping',
    weightGrams: null,
    dimensions: null,
    options: [],
    variants: [variant()],
    images: [],
    fitments: [],
    productTypeKey: null,
    attributes: {},
    attributeSections: [],
    lowStock: false,
    madeToOrder: {
      orderAheadDays: null,
      deposit: { type: 'none' },
      dailyLimit: null,
      readyOn: null,
      remainingToday: null,
    },
    ...over,
  };
}

const recordFor = (p: PublicProduct) =>
  productToSilicaRecord(p, 'juniper-row', {
    defaultCurrency: 'USD',
    defaultLocale: 'en-US',
    paymentMode: 'card',
  });

const preorderOf = (record: Record<string, unknown>) => record.preorder as Record<string, unknown>;

describe('the preorder sentences', () => {
  it('says it is a preorder, when it ships, the note and what is left', () => {
    const preorder = preorderOf(
      recordFor(product({ variants: [variant({ available: 0, preorder: OFFER })] }))
    );

    expect(preorder.shown, 'panel hidden on a live preorder').toBe(true);
    expect(preorder.ships).toBe('Preorder: ships July 1, 2027');
    expect(preorder.note).toBe('Strung to order by the workshop in Lyon.');
    expect(preorder.scarce).toBe('6 left on this run');
  });

  it('prints the day the maker typed, not the day before it', () => {
    // The whole of issue 679. `availableAt` is a calendar day stored at UTC
    // midnight, so formatting it on the reader's clock moves it back a day for
    // everyone west of Greenwich. This assertion goes red if the
    // `timeZone: 'UTC'` in `formatArrival` is ever dropped.
    const preorder = preorderOf(
      recordFor(
        product({
          variants: [
            variant({
              available: 0,
              preorder: { ...OFFER, availableAt: '2027-03-10T00:00:00.000Z' },
            }),
          ],
        })
      )
    );
    expect(preorder.ships).toBe('Preorder: ships March 10, 2027');
  });

  it('will not invent a day it was never given', () => {
    const preorder = preorderOf(
      recordFor(
        product({
          variants: [variant({ available: 0, preorder: { ...OFFER, availableAt: null } })],
        })
      )
    );
    expect(preorder.ships).toBe('Preorder: shipping date to be confirmed');
    // And no month name has crept into the sentence from anywhere.
    expect(String(preorder.ships)).not.toMatch(/January|March|July|December/);
  });

  it('says nothing about a run with no limit', () => {
    // `remaining` is null for an uncapped run and there is no honest number for
    // "no limit", so the scarcity line has to be absent rather than "0 left".
    const preorder = preorderOf(
      recordFor(
        product({ variants: [variant({ available: 0, preorder: { ...OFFER, remaining: null } })] })
      )
    );
    expect(preorder.scarce).toBe('');
  });

  it('stays quiet while the thing is still on the shelf', () => {
    // A preorder is what you are offered INSTEAD of stock, so an item with stock
    // left goes on selling the ordinary way.
    const preorder = preorderOf(
      recordFor(product({ variants: [variant({ available: 4, preorder: OFFER })] }))
    );
    expect(preorder.shown).toBe(false);
  });

  it('stays quiet on a product sold in more than one version', () => {
    // The dangerous case. The window belongs to ONE version and this record is
    // the product, so a product-level sentence would promise a July date to
    // somebody buying a size that ships today.
    const preorder = preorderOf(
      recordFor(
        product({
          variants: [
            variant({ id: 'var_1', available: 0, preorder: OFFER }),
            variant({ id: 'var_2', isDefault: false, available: 12 }),
          ],
        })
      )
    );
    expect(preorder.shown).toBe(false);
  });

  it('carries every key on an ordinary product, so no empty panel renders', () => {
    // An absent ref is UNKNOWN to the engine, which keeps the node exactly as the
    // template authored it: that is how an empty bordered panel once rendered
    // under every product in the catalog. An empty value is FOUND, and dropped.
    const record = recordFor(product());
    expect(Object.keys(preorderOf(record)).sort()).toEqual(['note', 'scarce', 'ships', 'shown']);
    expect(preorderOf(record)).toEqual({ shown: false, ships: '', note: '', scarce: '' });
    expect(record.backInStock, 'must be present and empty, never missing').toBe('');
  });
});

describe('the back-in-stock sentence', () => {
  it('names the day when the business has named one', () => {
    const record = recordFor(
      product({ variants: [variant({ expectedBackAt: '2027-03-14T00:00:00.000Z' })] })
    );
    expect(record.backInStock).toBe('Back in stock March 14, 2027');
  });

  it('says nothing when nobody has promised anything', () => {
    expect(recordFor(product()).backInStock).toBe('');
  });

  it('says nothing when two versions come back on different days', () => {
    // Picking the earlier one tells somebody waiting on a large a date that is
    // not theirs.
    const record = recordFor(
      product({
        variants: [
          variant({ id: 'var_1', expectedBackAt: '2027-03-14T00:00:00.000Z' }),
          variant({ id: 'var_2', isDefault: false, expectedBackAt: '2027-06-02T00:00:00.000Z' }),
        ],
      })
    );
    expect(record.backInStock).toBe('');
  });

  it('names the day when every version agrees on it', () => {
    const record = recordFor(
      product({
        variants: [
          variant({ id: 'var_1', expectedBackAt: '2027-03-14T00:00:00.000Z' }),
          variant({ id: 'var_2', isDefault: false, expectedBackAt: '2027-03-14T00:00:00.000Z' }),
        ],
      })
    );
    expect(record.backInStock).toBe('Back in stock March 14, 2027');
  });
});
