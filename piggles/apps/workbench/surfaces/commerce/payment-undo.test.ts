import { describe, expect, it } from 'vitest';

import { canTakeOff, takeOffWords, TAKE_OFF_REASON } from './payment-undo';

/** A cash payment somebody typed at the counter: the shape this exists for. */
const CASH = { status: 'captured', byHand: true };

/** The same amount charged through a gateway, where the money really is. */
const CARD = { status: 'captured', byHand: false };

const SAID = { amount: '$33.00', orderNumber: 'O-000020' };

describe('canTakeOff', () => {
  it('offers it on money taken by hand and counted', () => {
    expect(canTakeOff(CASH)).toBe(true);
  });

  it('offers it on a hand-taken row still waiting', () => {
    expect(canTakeOff({ status: 'pending', byHand: true })).toBe(true);
  });

  it('offers it on a hand-taken hold', () => {
    expect(canTakeOff({ status: 'authorized', byHand: true })).toBe(true);
  });

  // Breaking this is the obvious simplification: gate on status alone, since the
  // server accepts any of these. It would put the action on a live card charge,
  // whose money is with the gateway and which this call cannot reach.
  it('never offers it on money a provider is holding', () => {
    expect(canTakeOff(CARD)).toBe(false);
    expect(canTakeOff({ status: 'pending', byHand: false })).toBe(false);
    expect(canTakeOff({ status: 'authorized', byHand: false })).toBe(false);
  });

  it('does not offer it twice', () => {
    expect(canTakeOff({ status: 'voided', byHand: true })).toBe(false);
  });

  it('does not offer it where the money was properly given back', () => {
    expect(canTakeOff({ status: 'refunded', byHand: true })).toBe(false);
  });

  // Breaking this looks tidy too: treat anything not finished as takeable. But a
  // failed payment was never counted, so there is no figure to correct and the
  // row already says what happened.
  it('does not offer it on a payment that never worked', () => {
    expect(canTakeOff({ status: 'failed', byHand: true })).toBe(false);
  });

  it('says no to a status it has never heard of', () => {
    expect(canTakeOff({ status: 'disputed', byHand: true })).toBe(false);
  });
});

describe('takeOffWords', () => {
  const words = takeOffWords(SAID);

  it('names the amount and the order in the title', () => {
    expect(words.title).toContain('$33.00');
    expect(words.title).toContain('O-000020');
  });

  it('says plainly that no money moves', () => {
    expect(words.confirm).toContain('No money moves');
    expect(words.done).toContain('No money was sent anywhere');
  });

  // The whole reason this dialog is long. Two presses on this pane look the same
  // and cost different things, so the one she did not press gets named.
  it('sends her to Refund when the money really did come in', () => {
    expect(words.confirm).toContain('Refund');
    expect(words.confirm).toContain('really did come in');
  });

  it('never promises the money is being sent back', () => {
    expect(words.confirm).not.toContain('back to the card');
    expect(words.done).not.toContain('given back');
  });

  // The badge on the row afterwards reads Canceled. Saying so in the dialog is
  // what stops that word looking like the ORDER was canceled.
  it('says what the line will read afterwards', () => {
    expect(words.confirm).toContain('Canceled');
  });

  it('predicts no new balance', () => {
    expect(words.confirm).not.toMatch(/now owes|will owe/);
  });

  it('writes no em dash anywhere a person reads', () => {
    for (const line of [words.title, words.confirm, words.done, TAKE_OFF_REASON]) {
      expect(line).not.toContain('—');
    }
  });

  it('records why the row is off', () => {
    expect(TAKE_OFF_REASON).toBe('Written down by mistake');
  });
});
