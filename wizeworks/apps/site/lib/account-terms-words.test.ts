// Issue 082: the checkout offered the buyer a choice of Net 15/30/60/90 that the
// invoice ignored. The screen now states the account's own terms instead.

import { describe, expect, it } from 'vitest';

import { accountTermsSentence, canBillToAccount, termsDays } from './account-terms-words';

describe('account terms words', () => {
  it('reads the days from the terms the shop gave the account', () => {
    expect(termsDays('net30')).toBe(30);
    // Salt Lake County is on Net 45, which the old list could not show.
    expect(termsDays('net45')).toBe(45);
    expect(termsDays('prepay')).toBeNull();
    expect(termsDays(null)).toBeNull();
  });

  it('offers billing to the account only when the account has day terms', () => {
    expect(canBillToAccount('net30')).toBe(true);
    expect(canBillToAccount('prepay')).toBe(false);
    // No terms set: the shop has not agreed when this account pays.
    expect(canBillToAccount(undefined)).toBe(false);
  });

  it('tells the buyer when they pay, in days', () => {
    expect(accountTermsSentence('net30')).toBe(
      'Nothing is charged now. We add this order to your account, and you pay within 30 days of the invoice date.'
    );
    expect(accountTermsSentence('net1')).toMatch(/within 1 day of/);
  });

  // Sparx persona issue 087: an order over the spending limit is not added to
  // the account until it is approved.
  it('says a held order is added to the account once it is approved', () => {
    expect(accountTermsSentence('net30', true)).toBe(
      'Nothing is charged now. Once it is approved, we add it to your account, and you pay within 30 days of the invoice date.'
    );
    expect(accountTermsSentence('prepay', true)).toBe('Nothing is charged now.');
  });
});
