import { describe, expect, it } from 'vitest';

import {
  MATCH_LIMIT,
  categoryAddedToast,
  chosenSummary,
  fitmentAddedToast,
  fitmentRemovedToast,
  selectionBody,
  targetCount,
  wholeResultOffer,
  type BulkTarget,
} from './products-bulk-words';
import { rangesFromDrafts } from './fitment-rule-words';

/**
 * Issue 065: Gillett Diesel searches "Fuel System", sees 50 of 126, and has to be
 * able to act on all 126. The offer appears only once the whole page is ticked,
 * the count it names is the server's total, and every result names what moved
 * and what did not.
 */

describe('wholeResultOffer', () => {
  it('offers every match once the whole page is ticked and more match than the page', () => {
    expect(
      wholeResultOffer({ allOnPageChosen: true, chosen: 50, total: 126, narrowed: true })
    ).toEqual({
      kind: 'offer',
      label: 'Choose all 126 that match',
    });
  });

  it('says nothing while only part of the page is ticked', () => {
    expect(
      wholeResultOffer({ allOnPageChosen: false, chosen: 12, total: 126, narrowed: true })
    ).toBeNull();
  });

  it('says nothing when the page already holds every match', () => {
    expect(
      wholeResultOffer({ allOnPageChosen: true, chosen: 18, total: 18, narrowed: true })
    ).toBeNull();
  });

  it('says why it cannot, past the limit, instead of offering a button that fails', () => {
    const offer = wholeResultOffer({
      allOnPageChosen: true,
      chosen: 50,
      total: MATCH_LIMIT + 1,
      narrowed: false,
    });
    expect(offer?.kind).toBe('too-many');
  });
});

describe('the selection sent to the server', () => {
  const match = { q: 'injector', productType: 'Fuel System' };

  it('sends the narrowing, not the ids on screen, when every match is chosen', () => {
    const target: BulkTarget = { kind: 'match', match, total: 126 };
    expect(selectionBody(target)).toEqual({ match });
    expect(targetCount(target)).toBe(126);
    expect(chosenSummary(target, true)).toBe('All 126 that match chosen');
  });

  it('sends exactly the ticked ids otherwise', () => {
    const target: BulkTarget = { kind: 'ids', productIds: ['a', 'b'] };
    expect(selectionBody(target)).toEqual({ productIds: ['a', 'b'] });
    expect(chosenSummary(target, true)).toBe('2 products chosen');
  });
});

describe('result toasts', () => {
  it('names what moved and what was already there', () => {
    expect(
      categoryAddedToast({ changed: 120, unchanged: 6, skipped: 0, categoryName: 'Fuel System' })
    ).toEqual({ title: '120 products put in “Fuel System”', description: '6 were in it already.' });
  });

  it('does not claim a change when there was none', () => {
    expect(
      fitmentAddedToast({ rules: 0, productsChanged: 0, productsUnchanged: 34, skipped: 0 }, 'L5P')
        .title
    ).toBe('Nothing to add: they all fit L5P already');
  });

  it('agrees the verb with one product', () => {
    expect(
      fitmentAddedToast({ rules: 1, productsChanged: 1, productsUnchanged: 0, skipped: 0 }, 'L5P')
        .title
    ).toBe('1 product now fits L5P');
  });
});

describe('rangesFromDrafts', () => {
  const year = { key: 'year', label: 'Year', kind: 'range' as const, unit: 'year' };

  it('keeps an open end as null and skips blank axes', () => {
    expect(rangesFromDrafts([year], { year: { min: '', max: '2019' } })).toEqual({
      ranges: [{ dimensionKey: 'year', min: null, max: 2019 }],
      problem: null,
    });
    expect(rangesFromDrafts([year], { year: { min: ' ', max: '' } }).ranges).toEqual([]);
  });

  it('refuses years typed the wrong way round instead of saving them', () => {
    expect(rangesFromDrafts([year], { year: { min: '2023', max: '2017' } }).problem).toBe(
      'The first year has to come before the second.'
    );
  });
});

describe('fitmentRemovedToast, a whole list taken off', () => {
  // Taking off "everything in Vehicle" leaves them fitting nothing there, so the
  // toast must not say they "no longer fit everything" (sparx persona issue 070).
  it('says they no longer fit anything in it', () => {
    const toast = fitmentRemovedToast(
      { rules: 4, productsChanged: 1, productsUnchanged: 0, skipped: 0 },
      'everything in Vehicle'
    );
    expect(toast.title).toBe('1 product no longer fits anything in Vehicle');
  });

  it('says plainly when they fit nothing there to begin with', () => {
    const toast = fitmentRemovedToast(
      { rules: 0, productsChanged: 0, productsUnchanged: 1, skipped: 0 },
      'everything in Vehicle'
    );
    expect(toast.title).toBe('Nothing to remove: none of them fit anything in Vehicle');
  });
});
