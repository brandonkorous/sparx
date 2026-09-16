import { describe, expect, it } from 'vitest';
import { quickCostProblem } from './quick-cost';

/**
 * A GREY BUTTON THAT WOULD NOT SAY WHY.
 *
 * The quick cost row takes an amount, what it was for, and a category, and the
 * Record button needs all three. The row only ever explained ONE of them, and
 * only when the amount was unreadable. So somebody who typed $12.50 and "Horn
 * buttons from the Saturday market" and then went to press Record found it grey,
 * with nothing anywhere on the screen saying a category was still wanted.
 *
 * `canSave` knew. It just never said so.
 *
 * Every guard below is about a sentence a person reads, so each asserts the
 * whole sentence rather than "is not null" — a wrong sentence is the defect
 * being fixed, not a smaller version of it.
 */
describe('why the quick cost row cannot be recorded yet', () => {
  const row = (over: Partial<Parameters<typeof quickCostProblem>[0]> = {}) => ({
    amount: '12.50',
    amountCents: 1250,
    description: 'Horn buttons from the Saturday market',
    categoryId: 'cat_materials',
    ...over,
  });

  it('says nothing about a row nobody has typed in', () => {
    // A pane that opens already telling somebody off is worse than one that
    // waits. Silence here is the whole reason the touched check exists.
    expect(
      quickCostProblem({ amount: '', amountCents: null, description: '', categoryId: '' })
    ).toBe(null);
  });

  it('says nothing when all three are filled in', () => {
    expect(quickCostProblem(row())).toBe(null);
  });

  it('names the category, which is the one she cannot guess', () => {
    expect(quickCostProblem(row({ categoryId: '' }))).toBe('Add a category to record this.');
  });

  it('names two missing things in one sentence, in the order the row reads', () => {
    expect(quickCostProblem(row({ description: '', categoryId: '' }))).toBe(
      'Add what it was for and a category to record this.'
    );
  });

  it('names the amount and the category when only the description has been typed', () => {
    expect(
      quickCostProblem({
        amount: '',
        amountCents: null,
        description: 'Horn buttons',
        categoryId: '',
      })
    ).toBe('Add an amount and a category to record this.');
  });

  it('can never have to name all three, and that is by construction', () => {
    // Worth stating, because the first draft of the test above expected a
    // three-part sentence and it could not happen. Naming all three needs the
    // amount AND the description both empty, and that is exactly an untouched
    // row, which answers null. So the sentence is one or two things, never more.
    const both = quickCostProblem({
      amount: '',
      amountCents: null,
      description: '',
      categoryId: '',
    });
    expect(both).toBe(null);
  });

  it('keeps the old sentence for an amount it cannot read', () => {
    expect(quickCostProblem(row({ amount: 'about twelve', amountCents: null }))).toBe(
      'That amount is not a number we can read. Try something like 42.50.'
    );
  });

  it('does not tell her to add an amount she has already typed', () => {
    // The trap this guard exists for: "about twelve" parses to null, and a
    // missing-fields list built from `amountCents` alone would answer a filled
    // box with "add an amount". The malformed sentence has to win.
    expect(quickCostProblem(row({ amount: 'about twelve', amountCents: null }))).not.toContain(
      'Add an amount'
    );
  });

  it('refuses a zero in its own words rather than calling it missing', () => {
    expect(quickCostProblem(row({ amount: '0', amountCents: 0 }))).toBe(
      'A cost has to be more than nothing. Put in what it actually came to.'
    );
  });

  it('stays quiet after a save, when only the sticky category is left behind', () => {
    // A saved cost clears the amount and the description and KEEPS the category,
    // because a run of receipts is usually a run of the same kind of thing. If
    // that leftover counted as a start, the row would nag after every success.
    expect(
      quickCostProblem({ amount: '', amountCents: null, description: '', categoryId: 'cat_fuel' })
    ).toBe(null);
  });
});
