// A limit of zero is a locked door, not a blank field.
//
// ── The defect this exists for ───────────────────────────────────────────────
//
// `companies.credit_limit` is `NUMERIC NOT NULL DEFAULT 0`, and the checkout
// subtracts it: `available = creditLimit - creditUsed`, refuse if the order is
// bigger. So a zero refuses every order placed on payment terms. It is a
// decision with teeth, and every screen drew it as an absence — `$0.00` in a
// column, a blank box offering "Leave blank for none", and, in the trade app's
// list, the words "No credit set" printed over an outstanding balance of
// $1,193.
//
// MEASURED 2026-09-25 against the dev database: 18 companies have a real limit,
// 10 are at zero with nothing outstanding, and 1 is at zero owing $1,193. Those
// last eleven are all stopped at checkout.
// [[feedback_never_present_absence_as_measurement]]
// [[feedback_verify_capability_in_code_not_docs]]

import { describe, expect, it } from 'vitest';

import { creditStanding } from './credit-standing';

describe('reading an account credit standing', () => {
  it('reports a recorded ceiling', () => {
    expect(creditStanding(5000, 1193)).toBe('limit');
    expect(creditStanding(5000, 0)).toBe('limit');
    // A limit can be fully used, or overrun. It is still a limit.
    expect(creditStanding(1000, 1000)).toBe('limit');
    expect(creditStanding(1000, 2500)).toBe('limit');
  });

  it('separates money owed on a closed door from a closed door alone', () => {
    // The state both apps got wrong, and the one a live account is in.
    expect(creditStanding(0, 1193)).toBe('owing');
    expect(creditStanding(0, 0)).toBe('noTerms');
  });

  it('reads the decimal strings the Customers app is handed', () => {
    // The CRM list and detail pane receive Prisma Decimals as strings.
    expect(creditStanding('0.00', '1193.00')).toBe('owing');
    expect(creditStanding('0.00', '0.00')).toBe('noTerms');
    expect(creditStanding('5000.00', '1193.00')).toBe('limit');
  });

  it('treats a missing or unreadable figure the way the checkout would', () => {
    // `Number('')` is NaN, NaN fails `orderDollars > available`, and the order
    // is refused. A display helper must not be cheerier than the till.
    expect(creditStanding(null, null)).toBe('noTerms');
    expect(creditStanding(undefined, undefined)).toBe('noTerms');
    expect(creditStanding('', '')).toBe('noTerms');
    expect(creditStanding('not a number', 'not a number')).toBe('noTerms');
    // Unreadable limit, real balance: still money owed, still no terms.
    expect(creditStanding('not a number', '1193.00')).toBe('owing');
  });

  it('never calls a negative figure a limit', () => {
    // Nothing writes one, but a limit below zero refuses orders exactly as a
    // zero does, so it has to read the same way.
    expect(creditStanding(-100, 0)).toBe('noTerms');
    expect(creditStanding(-100, 50)).toBe('owing');
  });
});
