import { describe, expect, it } from 'vitest';

import { isExampleKind, sameAsInstalled } from './blueprint-untouched.js';

/**
 * THE RULE THAT DECIDES WHETHER A BUSINESS OWNER IS TOLD HER OWN WORK IS A
 * PLACEHOLDER.
 *
 * `reportUntouched` drives one sentence on Home: your website still shows the
 * example words. It is worth having tests because both ways of being wrong are
 * silent and one of them is insulting.
 *
 * Reading a database default as an edit reports nothing, and a panel that never
 * appears looks exactly like a product with no such defect. Reading her edit as
 * the example tells her the thing she wrote is not hers.
 */
describe('sameAsInstalled', () => {
  it('sees an untouched product through the columns nobody filled in', () => {
    // Measured on a real install: the design set four fields, and the row came
    // back carrying three more that the database wrote on insert.
    const baseline = {
      title: 'Rowan Enamel Mug',
      handle: 'rowan-enamel-mug',
      status: 'active',
      variants: [{ sku: 'ROWAN-MUG-1', priceCents: 1800 }],
    };
    const live = {
      title: 'Rowan Enamel Mug',
      handle: 'rowan-enamel-mug',
      status: 'active',
      variants: [{ sku: 'ROWAN-MUG-1', priceCents: 1800, compareAtPriceCents: null }],
      tags: [],
      fulfillmentType: 'physical',
      requiresShipping: true,
    };
    expect(sameAsInstalled(baseline, live)).toBe(true);
  });

  it('sees her words the moment she writes them', () => {
    expect(
      sameAsInstalled({ title: 'Rowan Enamel Mug' }, { title: 'Our house mug', tags: [] })
    ).toBe(false);
  });

  it('sees a field she cleared, which is an edit like any other', () => {
    expect(sameAsInstalled({ description: 'Example words.' }, { description: null })).toBe(false);
  });

  it('reads absent, null, empty text and an empty list as the same nothing', () => {
    expect(sameAsInstalled({ a: null }, {})).toBe(true);
    expect(sameAsInstalled({ a: '' }, { a: null })).toBe(true);
    expect(sameAsInstalled({ a: [] }, {})).toBe(true);
    expect(sameAsInstalled({}, { a: 'something the database wrote' })).toBe(true);
  });

  it('does not read whitespace as a sentence', () => {
    expect(sameAsInstalled({ description: '   ' }, { description: null })).toBe(true);
  });

  it('sees a price change inside a list', () => {
    expect(
      sameAsInstalled(
        { variants: [{ sku: 'A', priceCents: 1800 }] },
        { variants: [{ sku: 'A', priceCents: 2000 }] }
      )
    ).toBe(false);
  });

  it('sees a variant added or removed', () => {
    expect(
      sameAsInstalled({ variants: [{ sku: 'A' }] }, { variants: [{ sku: 'A' }, { sku: 'B' }] })
    ).toBe(false);
    expect(
      sameAsInstalled({ variants: [{ sku: 'A' }, { sku: 'B' }] }, { variants: [{ sku: 'A' }] })
    ).toBe(false);
  });

  it('goes as deep as a page tree', () => {
    const tree = { type: 'root', children: [{ type: 'text', text: 'This is your homepage.' }] };
    const hers = { type: 'root', children: [{ type: 'text', text: 'We open at seven.' }] };
    expect(sameAsInstalled({ tree }, { tree })).toBe(true);
    expect(sameAsInstalled({ tree }, { tree: hers })).toBe(false);
  });

  it('does not treat a false as a missing value', () => {
    // `false` and `0` are values somebody chose. Folding them into "empty"
    // would make un-ticking a box invisible.
    expect(sameAsInstalled({ noindex: true }, { noindex: false })).toBe(false);
    expect(sameAsInstalled({ priceCents: 1800 }, { priceCents: 0 })).toBe(false);
  });
});

describe('isExampleKind', () => {
  it('counts the furniture, and only the furniture', () => {
    // An unedited About page says nothing about the business. An unedited shop
    // sells an invented brand's mug to the business's customers, and an
    // unedited Journal publishes the platform's marketing under her masthead.
    expect(isExampleKind('product')).toBe(true);
    expect(isExampleKind('content')).toBe(true);
    for (const kind of ['page', 'theme', 'brand', 'frame', 'email', 'category', 'collection']) {
      expect(isExampleKind(kind as 'page')).toBe(false);
    }
  });
});
