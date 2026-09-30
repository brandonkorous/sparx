import { describe, expect, it } from 'vitest';
import { balanceNote, pickerState, takeBackCheck, whichPerson } from './account-credit-words';

describe('telling two people apart', () => {
  it('leads with the company, because that is who a trade credit is really for', () => {
    expect(whichPerson({ company: 'Loom & Larder', email: 'priya@loomandlarder.co.uk' })).toBe(
      'Loom & Larder · priya@loomandlarder.co.uk'
    );
  });

  it('never returns a blank line for someone with nothing on file', () => {
    // The whole defect: two rows both reading "Priya Anand", one with an email
    // and one with an empty space beside it, and real money going on the guess.
    expect(whichPerson({})).toBe('No email or phone yet');
    expect(whichPerson({ email: '  ', phone: null, company: null })).toBe('No email or phone yet');
  });

  it('says when the person was added, which is what separates two empty rows', () => {
    expect(whichPerson({ addedOn: '19 Sep 2026' })).toBe(
      'No email or phone yet, added 19 Sep 2026'
    );
  });

  it('shows the phone only when there is nothing better to show', () => {
    expect(whichPerson({ phone: '0117 496 0001' })).toBe('0117 496 0001');
    expect(whichPerson({ email: 'wren.ashcombe@example.com', phone: '0117 496 0001' })).toBe(
      'wren.ashcombe@example.com'
    );
  });
});

describe('what the toast says after the balance moves', () => {
  it('names the amount, the person and the balance the server reported', () => {
    expect(balanceNote('$18.50', 'Wren Ashcombe', '$18.50')).toBe(
      '$18.50 for Wren Ashcombe. Their balance is now $18.50.'
    );
  });
});

describe('taking credit back', () => {
  it('says nothing at all about an empty box', () => {
    // Empty is not zero and is not a mistake. Scolding someone for not having
    // typed yet is how a form reads as broken.
    expect(takeBackCheck(undefined, 1850, '$18.50')).toEqual({ ok: false });
  });

  it('refuses more than the balance, and names the balance', () => {
    expect(takeBackCheck(5000, 1850, '$18.50')).toEqual({
      ok: false,
      problem: 'That is more than $18.50, which is all they hold.',
    });
  });

  it('allows exactly the balance, because undoing a whole mistake is the point', () => {
    expect(takeBackCheck(1850, 1850, '$18.50')).toEqual({ ok: true });
  });

  it('says there is nothing to take back before it says the amount is too big', () => {
    expect(takeBackCheck(500, 0, '$0.00')).toEqual({
      ok: false,
      problem: 'There is nothing on this account to take back.',
    });
  });

  it('asks for an amount when zero is typed', () => {
    expect(takeBackCheck(0, 1850, '$18.50')).toEqual({
      ok: false,
      problem: 'Enter how much to take back.',
    });
  });
});

describe('what the customer picker is doing', () => {
  const ask = (over: Partial<Parameters<typeof pickerState>[0]> = {}) =>
    pickerState({ query: 'marguerite', isError: false, isFetching: false, count: 0, ...over });

  it('prompts before anything is typed', () => {
    expect(ask({ query: '   ' }).mood).toBe('prompt');
  });

  it('does NOT report a failed search as nobody matching', () => {
    // The defect, in one assertion. Seventeen 503s read on screen as "No
    // customer matches that" about a shop that had the customer all along.
    const state = ask({ isError: true });
    expect(state.mood).toBe('failed');
    expect(state.message).not.toContain('No customer matches');
    expect(state.message).toContain('Try again in a moment');
  });

  it('stays a failure while it is retrying, rather than spinning forever', () => {
    expect(ask({ isError: true, isFetching: true }).mood).toBe('failed');
  });

  it('says it is searching only while a first answer is still coming', () => {
    expect(ask({ isFetching: true }).mood).toBe('searching');
    expect(ask({ isFetching: true, count: 3 }).mood).toBe('results');
  });

  it('offers a different word only when the server really answered with none', () => {
    const state = ask();
    expect(state.mood).toBe('empty');
    expect(state.message).toContain('Try a different word');
  });
});
