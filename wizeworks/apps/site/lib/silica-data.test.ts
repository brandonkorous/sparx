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
import { productToBuilderRecord } from './builder-commerce-data';
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
    coreChargeCents: null,
    coreFirstOffered: false,
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

describe('the core deposit sentences (sparx issue 051)', () => {
  const coreOf = (record: Record<string, unknown>) =>
    record.coreDeposit as { shown: boolean; headline: string; detail: string };

  it('says the deposit before the button when every version carries the same one', () => {
    const record = recordFor(product({ variants: [variant({ coreChargeCents: 15_000 })] }));
    expect(coreOf(record)).toMatchObject({
      shown: true,
      headline: 'Plus a $150.00 refundable core deposit',
    });
    expect(coreOf(record).detail).toMatch(/return your old part/);
  });

  it('names each version’s own deposit when they differ', () => {
    const record = recordFor(
      product({
        options: [
          {
            id: 'opt',
            name: 'Core Charge',
            position: 0,
            values: [
              { id: 'accept', value: 'Accept Core Charge', position: 0 },
              { id: 'defer', value: 'Defer Core Charge', position: 1 },
            ],
          },
        ] as PublicProduct['options'],
        variants: [
          variant({ id: 'a', optionValueIds: ['accept'], coreChargeCents: 15_000 }),
          variant({ id: 'd', optionValueIds: ['defer'], coreChargeCents: null, isDefault: false }),
        ],
      })
    );
    expect(coreOf(record).headline).toMatch(/Some versions/);
    const labels = (record.versions as { label: string }[]).map((v) => v.label);
    expect(labels).toContain('Accept Core Charge, plus $150.00 core deposit');
    expect(labels).toContain('Defer Core Charge');
  });

  it('says nothing for a part with no deposit', () => {
    expect(coreOf(recordFor(product())).shown).toBe(false);
  });
});

describe('the old-part choice (sparx issue 057)', () => {
  const choiceOf = (record: Record<string, unknown>) =>
    record.coreChoice as { shown: boolean; pay: string; first: string };
  const headlineOf = (record: Record<string, unknown>) =>
    (record.coreDeposit as { headline: string }).headline;

  it('offers both ways on a part that can be bought both ways', () => {
    const record = recordFor(
      product({ variants: [variant({ coreChargeCents: 15_000, coreFirstOffered: true })] })
    );
    expect(choiceOf(record)).toEqual({
      shown: true,
      pay: 'Pay the $150.00 core deposit now. Your part is ready right away, and we pay the deposit back when your old part comes back.',
      first: 'Send your old part first. No deposit. Your part is ready once it arrives.',
    });
  });

  it('stops the deposit note promising extra money a buyer may not pay', () => {
    // "Plus a $150.00 deposit" above a choice whose second answer is "No deposit"
    // tells the buyer two different things about the same money.
    const record = recordFor(
      product({ variants: [variant({ coreChargeCents: 15_000, coreFirstOffered: true })] })
    );
    expect(headlineOf(record)).toBe(
      'A $150.00 refundable core deposit, or send your old part first'
    );
  });

  it('keeps the plain deposit note, and no choice, when the part takes the deposit only', () => {
    const record = recordFor(product({ variants: [variant({ coreChargeCents: 15_000 })] }));
    expect(choiceOf(record)).toEqual({ shown: false, pay: '', first: '' });
    expect(headlineOf(record)).toBe('Plus a $150.00 refundable core deposit');
  });

  it('offers nothing on a part with no deposit, whatever the flag says', () => {
    const record = recordFor(product({ variants: [variant({ coreFirstOffered: true })] }));
    expect(choiceOf(record).shown).toBe(false);
  });

  it('follows the version the page opens on', () => {
    const record = recordFor(
      product({
        variants: [
          variant({ id: 'a', coreChargeCents: 15_000 }),
          variant({ id: 'b', coreChargeCents: 15_000, coreFirstOffered: true, isDefault: false }),
        ],
      })
    );
    expect(choiceOf(record).shown).toBe(false);
  });

  it('says when only some versions can be bought this way, and quotes no single deposit', () => {
    const record = recordFor(
      product({
        variants: [
          variant({ id: 'a', coreChargeCents: 15_000, coreFirstOffered: true }),
          variant({ id: 'b', coreChargeCents: 20_000, isDefault: false }),
        ],
      })
    );
    expect(choiceOf(record)).toEqual({
      shown: true,
      pay: 'Pay the core deposit now. Your part is ready right away, and we pay the deposit back when your old part comes back.',
      first:
        'Send your old part first. No deposit. Your part is ready once it arrives. Not every version can be bought this way.',
    });
  });
});

describe('the builder buy box record', () => {
  it('carries the deposit and the send-first flag to the builder page (issues 051, 057)', () => {
    // The builder buy box has drawn a deposit line since 051, and this record never
    // carried the figure, so on a builder page the line could not appear. The
    // old-part choice reads the same variant, so it would have been missing too.
    const record = productToBuilderRecord(
      product({ variants: [variant({ coreChargeCents: 15_000, coreFirstOffered: true })] }),
      'doty',
      'USD'
    );
    expect(record.variants[0]).toMatchObject({ coreChargeCents: 15_000, coreFirstOffered: true });
  });
});
