import { describe, expect, it } from 'vitest';
import { formatCentsSigned, formatCentsUnsigned, profitOutcome } from './format';

/**
 * THE BOTTOM LINE, AS A PERSON READS IT.
 *
 * The profit screen said this, twice on one card, over a real shop's September:
 *
 *     You lost
 *     −$1,410.80
 *
 * Three things there say the figure is negative: the word "lost", the red, and
 * the minus sign. The first two agree with each other and the third argues with
 * them, because losing a negative amount is a gain. A business owner reading
 * quickly gets the wrong answer from the loudest part of the screen.
 *
 * So the word carries the direction and the number carries the size. The signed
 * formatter stays, and stays right, for every place where nothing beside the
 * number says which way it went.
 *
 * Proven red three ways: signing `formatCentsUnsigned` reddens three of these,
 * swapping the two words reddens three, and calling a break-even a loss reddens
 * one. Only the last guard stays green under all three, on purpose: it asserts
 * the SIGNED formatter still signs, which is a statement about the half that did
 * not change and is what stops this being read as "never print a minus".
 */
describe('a figure whose direction is already in the words', () => {
  const WORDS = { kept: 'You kept', lost: 'You lost' };
  const MINUS = /[-−]/;

  it('names the loss in words and prints the size without a sign', () => {
    const out = profitOutcome(-141_080, 'USD', WORDS);
    expect(out.label).toBe('You lost');
    expect(out.amount).toBe('$1,410.80');
    // Asserted as an ABSENCE as well as a value: "$1,410.80" would still be
    // `toBe`-equal to itself if some future currency put the sign at the end.
    expect(out.amount).not.toMatch(MINUS);
  });

  it('names the profit in words and prints the same size the same way', () => {
    const out = profitOutcome(50_000, 'USD', WORDS);
    expect(out.label).toBe('You kept');
    expect(out.amount).toBe('$500.00');
  });

  it('treats breaking exactly even as kept, not lost', () => {
    // Zero is not a loss. `< 0` is the only test that gets this right; `<= 0`
    // would tell a shop that broke even that it lost money.
    const out = profitOutcome(0, 'USD', WORDS);
    expect(out.label).toBe('You kept');
    expect(out.lost).toBe(false);
    expect(out.amount).toBe('$0.00');
  });

  it('drops the sign on a loss and leaves a profit untouched', () => {
    expect(formatCentsUnsigned(-141_080)).toBe('$1,410.80');
    expect(formatCentsUnsigned(-141_080)).not.toMatch(MINUS);
    expect(formatCentsUnsigned(50_000)).toBe('$500.00');
  });

  it('still SIGNS a figure through the signed formatter, which other screens need', () => {
    // The pair is the point. A column of jobs and the line "What the work made"
    // carry no direction word, so there the sign is the only thing saying it.
    expect(formatCentsSigned(-141_080)).toMatch(MINUS);
    expect(formatCentsSigned(-141_080)).toBe('−$1,410.80');
  });

  it('keeps the currency it was handed', () => {
    expect(profitOutcome(-141_080, 'GBP', WORDS).amount).toBe('£1,410.80');
  });
});
