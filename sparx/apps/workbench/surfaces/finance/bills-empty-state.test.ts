import { describe, expect, it } from 'vitest';
import { billsEmptyState } from './format';

/**
 * TWO TABS, TWO OPPOSITE CLAIMS, BOTH FALSE.
 *
 * Money -> Bills to pay, 2026-09-16. Five unpaid costs, $2,158.70, every one of
 * them recorded through the Spending quick-add, which never asks for a due date.
 * Both dated tabs therefore filtered down to nothing, and said:
 *
 *     Late         "Every bill you owe is still within its due date."
 *     Coming up    "Everything outstanding is already past its due date."
 *
 * Three seconds apart, and they contradict each other. Neither could be true,
 * because not one of her bills had a due date to be inside or past. The first
 * one is the dangerous half: it reads as reassurance. She owes $2,158.70 that
 * nothing on this platform will ever flag, and the screen told her every bill
 * was fine.
 *
 * Measured the same day: BOTH tenants with unpaid costs were in this exact
 * state, so the sentence was false 100% of the time it could be reached.
 *
 * The shape is the one that keeps recurring here: one empty result, two causes,
 * different remedies. "Nothing is late" needs no action. "Nothing has a date to
 * be late against" needs the owner to open a cost and set one, or the tab stays
 * empty for ever.
 */
describe('billsEmptyState', () => {
  const NONE_DATED = { dated: 0, undated: 5 };
  const ALL_DATED = { dated: 3, undated: 0 };
  const MIXED = { dated: 3, undated: 5 };

  it('never claims a bill is inside its due date when no bill has one', () => {
    const late = billsEmptyState('overdue', NONE_DATED);
    expect(late.description).not.toContain('still inside it');
    expect(late.description).toContain('none of your 5 unpaid costs has one');
  });

  it('never claims a bill is past its due date when no bill has one', () => {
    const soon = billsEmptyState('due_soon', NONE_DATED);
    expect(soon.description).not.toContain('already past it');
    expect(soon.description).toContain('none of your 5 unpaid costs has one');
  });

  it('says the same thing on both tabs when the cause is the same', () => {
    // The two tabs contradicted each other because each guessed from its own
    // name. One cause has to produce one sentence.
    expect(billsEmptyState('overdue', NONE_DATED)).toEqual(billsEmptyState('due_soon', NONE_DATED));
  });

  it('names the remedy and the control that carries it', () => {
    const { description } = billsEmptyState('overdue', NONE_DATED);
    expect(description).toContain('Due by');
    expect(description).toContain('Switch to All to see them.');
  });

  it('counts one dateless cost in the singular', () => {
    expect(billsEmptyState('overdue', { dated: 0, undated: 1 }).description).toContain(
      '1 unpaid cost has one'
    );
  });

  it('says nothing is late when bills do have dates and none has passed', () => {
    const { title, description } = billsEmptyState('overdue', ALL_DATED);
    expect(title).toBe('Nothing is late');
    expect(description).toBe(
      'Every bill with a day to pay it by is still inside it. Switch to All to see them.'
    );
  });

  it('says nothing is coming when bills do have dates and all have passed', () => {
    const { title, description } = billsEmptyState('due_soon', ALL_DATED);
    expect(title).toBe('Nothing coming up');
    expect(description).toBe(
      'Every bill with a day to pay it by is already past it. Switch to All to see them.'
    );
  });

  it('scopes the claim to dated bills when the list also holds dateless ones', () => {
    // The original sentence said "every bill you owe", which swept in five bills
    // this tab cannot see. Whatever it claims must be true of the rows it filtered.
    for (const band of ['overdue', 'due_soon'] as const) {
      const { description } = billsEmptyState(band, MIXED);
      expect(description).toContain('Every bill with a day to pay it by');
      expect(description).not.toContain('Every bill you owe');
    }
  });
});
