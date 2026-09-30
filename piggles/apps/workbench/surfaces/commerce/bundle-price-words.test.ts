import { describe, expect, it } from 'vitest';
import { partLineNote, partsNote, setPriceNote } from './bundle-price-words';

/** The pane's own formatter, near enough for a sentence test. */
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

describe('what the parts come to', () => {
  it('prompts rather than printing a total when the set is empty', () => {
    // $0.00 under an empty list is a measurement of nothing, which reads as a
    // free set rather than as an unfinished one.
    const note = partsNote(0, 0, money);
    expect(note.isPrompt).toBe(true);
    expect(note.text).not.toContain('$');
  });

  it('counts in words, both branches', () => {
    expect(partsNote(1, 12800, money).text).toBe('One part, $128.00.');
    expect(partsNote(2, 18600, money).text).toBe('2 parts add up to $186.00.');
  });
});

describe('what a shopper pays', () => {
  const ask = (over: Partial<Parameters<typeof setPriceNote>[0]> = {}) =>
    setPriceNote({
      pricingMode: 'sum_of_components',
      partCount: 2,
      partsCents: 18600,
      setCents: 18600,
      money,
      ...over,
    });

  it('says nothing about money before there are parts', () => {
    expect(ask({ partCount: 0 }).text).not.toContain('$');
  });

  it('names the total for a set priced at the sum of its parts', () => {
    // The sentence this replaces said "the set costs whatever its parts add up
    // to at their normal prices" and never said what that was.
    expect(ask().text).toBe('Shoppers pay $186.00, the same as buying the parts on their own.');
    expect(ask().tone).toBeNull();
  });

  it('names the saving', () => {
    expect(ask({ pricingMode: 'percent_off_sum', setCents: 15810 }).text).toBe(
      'Shoppers pay $158.10, saving $27.90 against the parts on their own.'
    );
  });

  it('WARNS when the set costs more than buying the parts one at a time', () => {
    const note = ask({ pricingMode: 'fixed', setCents: 20000 });
    expect(note.tone).toBe('warning');
    expect(note.text).toContain('$14.00 MORE');
    expect(note.text).toContain('Check that is what you meant');
  });

  it('treats a flat price that lands exactly on the total as no saving', () => {
    const note = ask({ pricingMode: 'fixed', setCents: 18600 });
    expect(note.tone).toBeNull();
    expect(note.text).toContain('the same as buying the parts on their own');
  });

  it('handles a set given away', () => {
    expect(ask({ pricingMode: 'percent_off_sum', setCents: 0 }).text).toBe(
      'Shoppers pay $0.00, saving $186.00 against the parts on their own.'
    );
  });
});

describe('one part on its own row', () => {
  it('is just the price when there is one of it', () => {
    expect(partLineNote(12800, 1, money)).toBe('$128.00');
  });

  it('spells the multiplication when there is more than one', () => {
    expect(partLineNote(5800, 3, money)).toBe('3 × $58.00 = $174.00');
  });
});
