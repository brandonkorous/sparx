// The Standing box says what the chosen standing means.
//
// MEASURED 2026-10-06 on Gillett: O'Malley Ranch, suspended by the late-payment
// ladder over a bill 40 days late, read "Suspended" over "Put them on credit
// hold to stop new orders until they've paid what they owe." Nothing said who
// suspended them, why, or how to undo it (sparx persona issue 101).

import { describe, expect, it } from 'vitest';

import { standingHelp } from './accounts-data';

describe('standingHelp', () => {
  it('says a suspension came from a late bill and how to lift it', () => {
    const words = standingHelp('suspended');
    expect(words).toContain('30 days late');
    expect(words).toContain('Once they have paid, set Open for orders');
  });

  it('says a credit hold came from a late bill', () => {
    expect(standingHelp('credit_hold')).toContain('14 days late');
  });

  it('says the same of neither hold as of an open account', () => {
    const open = standingHelp('active');
    expect(standingHelp('suspended')).not.toBe(open);
    expect(standingHelp('credit_hold')).not.toBe(open);
    expect(standingHelp('inactive')).not.toBe(open);
  });
});
