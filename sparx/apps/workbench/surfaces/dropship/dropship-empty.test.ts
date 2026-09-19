// AN EMPTY DROPSHIP SCREEN MUST NOT DESCRIBE SOMEBODY ELSE'S SHOP.
//
// Measured: 12 businesses have Dropshipping switched on and 11 of them have
// connected no supplier at all. Every one of those 11 was told orders are routed
// to "one of your suppliers", and was advised on the profitability report to try
// a longer period or wait for its next sale — two remedies that cannot work when
// no supplier exists to ship anything.

import { describe, expect, it } from 'vitest';
import {
  dropshipProfitEmptyWords,
  supplierOrdersEmptyWords,
  supplierProductsEmptyWords,
} from './dropship-empty';

describe('supplierOrdersEmptyWords', () => {
  it('says nobody is shipping rather than that nothing has been routed', () => {
    // 11 of the 12 businesses with the app on, today.
    const words = supplierOrdersEmptyWords(0, false);
    expect(words.title).toBe('Nobody is shipping for you yet');
    expect(words.detail).toContain('you have not set one up');
    expect(words.connect).toBe('Connect a supplier that ships for you');
  });

  it('speaks of one supplier in the singular', () => {
    const words = supplierOrdersEmptyWords(1, false);
    expect(words.title).toBe('No supplier orders yet');
    expect(words.detail).toContain('your supplier ships');
    expect(words.detail).not.toContain('one of your suppliers');
  });

  it('speaks of several in the plural', () => {
    const words = supplierOrdersEmptyWords(3, false);
    expect(words.detail).toContain('one of your suppliers');
  });

  it('leaves a narrowed list alone whatever the supplier count', () => {
    // A filter matching nothing is its own answer and says nothing about setup.
    for (const count of [0, 1, 5]) {
      const words = supplierOrdersEmptyWords(count, true);
      expect(words.title).toBe('No orders match those filters');
      expect(words.connect).toBe(null);
    }
  });
});

describe('dropshipProfitEmptyWords', () => {
  it('does not send someone with no supplier to look at a longer period', () => {
    const words = dropshipProfitEmptyWords(0);
    expect(words.title).toBe('Nobody is shipping for you yet');
    // Case-insensitive: the rewrite that names WHICH kind of supplier is missing
    // made this its own sentence, so the phrase now starts with a capital. The
    // rule is that the screen says a longer period cannot help, not where the
    // clause happens to sit.
    expect(words.detail).toMatch(/longer period above will not change that/i);
    expect(words.detail).not.toContain('Try a longer period');
    expect(words.detail).not.toContain('your next sale');
    expect(words.connect).toBe('Connect a supplier that ships for you');
  });

  it('keeps the period advice once a supplier exists to sell through', () => {
    const words = dropshipProfitEmptyWords(2);
    expect(words.title).toBe('No dropship sales in this period');
    expect(words.detail).toContain('Try a longer period above');
    expect(words.connect).toBe(null);
  });
});

describe('the property both panes share', () => {
  it('only offers the connect button when there is nothing to connect from', () => {
    for (const count of [0, 1, 2, 9]) {
      const orders = supplierOrdersEmptyWords(count, false);
      const profit = dropshipProfitEmptyWords(count);
      expect(orders.connect !== null, `orders at ${String(count)}`).toBe(count === 0);
      expect(profit.connect !== null, `profit at ${String(count)}`).toBe(count === 0);
    }
  });

  it('never speaks of the reader having suppliers when they have none', () => {
    // The property: a sentence written for somebody who already routes orders
    // may not be shown to somebody who cannot route one.
    const assumesSetup = ['your suppliers', 'your supplier ships', 'your next sale'];
    for (const words of [supplierOrdersEmptyWords(0, false), dropshipProfitEmptyWords(0)]) {
      for (const phrase of assumesSetup) {
        expect(words.detail.includes(phrase), `${phrase} in "${words.detail}"`).toBe(false);
      }
    }
    // And the opposite: with a supplier connected, those sentences are correct
    // and must still be reachable.
    expect(supplierOrdersEmptyWords(1, false).detail).toContain('your supplier ships');
    expect(dropshipProfitEmptyWords(1).detail).toContain('your next sale');
  });
});

describe('the word that means two things', () => {
  // Juniper Row has TWO suppliers, Ashcombe Mills and Fairfield Trims, whose
  // bills she pays. She has no ship-direct supplier. Measured: 2 rows in
  // `inventory_suppliers`, 0 in `dropship_suppliers`. So a bare "you have not
  // connected a supplier yet" is contradicted by her own Suppliers screen, one
  // row up in the same app.
  const zeroCases = [
    ['orders', supplierOrdersEmptyWords(0, false)],
    ['profit', dropshipProfitEmptyWords(0)],
    ['products', supplierProductsEmptyWords(0, false)],
  ] as const;

  it('never claims she has no supplier full stop', () => {
    for (const [name, words] of zeroCases) {
      const said = `${words.title} ${words.detail}`;
      expect(said.includes('not connected a supplier'), name).toBe(false);
      expect(said.includes('No suppliers connected'), name).toBe(false);
    }
  });

  it('says which kind is missing, on every one of the three', () => {
    for (const [name, words] of zeroCases) {
      // The distinguishing act, in the same terms the navigation uses when it
      // calls this screen "Ship-direct suppliers".
      expect(
        /posts (it )?straight to|ships for you|posts straight to|another business/.test(
          words.detail
        ),
        `${name}: "${words.detail}"`
      ).toBe(true);
    }
  });

  it('says out loud that it is not the suppliers she buys from', () => {
    for (const [name, words] of zeroCases) {
      expect(
        words.detail.includes('different arrangement from the suppliers you buy from'),
        name
      ).toBe(true);
    }
  });

  it('does not put the ambiguous word back on the button', () => {
    // The sentence distinguished the two kinds and the button said "Connect a
    // supplier" directly underneath it. Whatever the label says, it may not be
    // the bare word the paragraph above just finished separating.
    for (const [name, words] of zeroCases) {
      expect(words.connect, name).not.toBe('Connect a supplier');
      expect(words.connect ?? '', name).toMatch(/ship|shipping|ships/i);
    }
  });

  it('words the button the same on all three', () => {
    // Three panes, one button, one wording. The reason this issue exists twice
    // is that a pane was written on its own and never read beside its siblings.
    const labels = new Set(zeroCases.map(([, words]) => words.connect));
    expect(labels.size, [...labels].join(' / ')).toBe(1);
  });

  it('offers the way out on all three', () => {
    for (const [name, words] of zeroCases) {
      expect(words.connect, name).toBe('Connect a supplier that ships for you');
    }
  });
});

describe('supplierProductsEmptyWords', () => {
  it('leaves a narrowed list alone', () => {
    const words = supplierProductsEmptyWords(0, true);
    expect(words.title).toBe('No products match those filters');
    expect(words.connect).toBe(null);
  });

  it('points at the sync once a supplier exists', () => {
    const words = supplierProductsEmptyWords(2, false);
    expect(words.detail).toContain('from its page');
    expect(words.connect).toBe(null);
  });
});
