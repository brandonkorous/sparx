import { describe, expect, it } from 'vitest';
import { lifecycleNotice } from './lifecycle';
import type { BillingPhaseView } from '../../surfaces/finance/bill-data';

// The sentences that tell somebody their business is about to stop working.
// Every one is checked for being TRUE, not merely present — a warning that names
// the wrong cause is worse than no warning, because it sends them to fix the
// wrong thing.

const view = (over: Partial<BillingPhaseView>): BillingPhaseView => ({
  phase: 'trialing',
  daysLeft: 10,
  trialEndsAt: '2026-09-06T10:15:19.163Z',
  suspendsAt: null,
  ...over,
});

describe('a healthy account is told nothing', () => {
  it('says nothing while paying', () => {
    expect(lifecycleNotice(view({ phase: 'active', daysLeft: null }))).toBeNull();
  });

  it('says nothing to an exempt account', () => {
    expect(lifecycleNotice(view({ phase: 'exempt', daysLeft: null }))).toBeNull();
  });

  it('says nothing before the answer has arrived', () => {
    // Not "Free trial" with a blank countdown. A value nobody measured must
    // never render as one, and this is the sentence that has to be right.
    expect(lifecycleNotice(undefined)).toBeNull();
  });
});

describe('a trial counts down and gets louder', () => {
  it('is calm with a fortnight left', () => {
    const life = lifecycleNotice(view({ daysLeft: 12 }));
    expect(life?.tone).toBe('calm');
    expect(life?.detail).toBe('12 days left');
    expect(life?.action).toBe('Set up payment');
  });

  it('turns to a warning at three days', () => {
    expect(lifecycleNotice(view({ daysLeft: 3 }))?.tone).toBe('warning');
    expect(lifecycleNotice(view({ daysLeft: 4 }))?.tone).toBe('calm');
  });

  it('says day, not days, on the last one', () => {
    const life = lifecycleNotice(view({ daysLeft: 1 }));
    expect(life?.detail).toBe('1 day left');
    expect(life?.sentence).toContain('ends in 1 day.');
  });

  it('promises nothing changes, which is what setting up payment does', () => {
    expect(lifecycleNotice(view({ daysLeft: 9 }))?.sentence).toBe(
      'Your free trial has 9 days left. Set up payment now and nothing changes when it ends.'
    );
  });
});

describe('grace does not name a cause it cannot know', () => {
  // `grace` covers a trial that ended without payment AND a renewal that failed.
  // Telling a customer of a year that their "trial has ended" is false, and it
  // sends them looking for a trial they never had.
  const life = lifecycleNotice(view({ phase: 'grace', daysLeft: 2 }));

  it('never says trial', () => {
    expect(life?.sentence.toLowerCase()).not.toContain('trial');
  });

  it('says what happens next, which is true either way', () => {
    expect(life?.sentence).toBe(
      'Your site stays online for 2 more days. After that it goes offline until a payment goes through.'
    );
    expect(life?.tone).toBe('danger');
  });
});

describe('suspended states the situation and the way out', () => {
  const life = lifecycleNotice(view({ phase: 'suspended', daysLeft: null }));

  it('says the site is offline, in those words', () => {
    expect(life?.detail).toBe('Your site is offline');
    expect(life?.sentence).toBe(
      'Your site is offline. It comes back as soon as a payment goes through.'
    );
  });

  it('offers the one action worth offering', () => {
    expect(life?.action).toBe('Keep my business running');
    expect(life?.tone).toBe('danger');
  });
});

describe('a countdown nobody measured is never printed as a number', () => {
  it('drops the number rather than saying "0 days left"', () => {
    // `?? 0` here would print a measurement nobody took, on the screen that
    // tells somebody their site is about to go dark. The warning survives; the
    // invented number does not.
    const life = lifecycleNotice(view({ daysLeft: null }));
    expect(life?.detail).toBe('Ending soon');
    expect(life?.sentence).not.toMatch(/\d/);
  });

  it('is never the calm one, because "comfortable" would be a claim', () => {
    expect(lifecycleNotice(view({ daysLeft: null }))?.tone).toBe('warning');
  });

  it('does the same in grace', () => {
    const life = lifecycleNotice(view({ phase: 'grace', daysLeft: null }));
    expect(life?.detail).toBe('Your site goes offline soon');
    expect(life?.sentence).not.toMatch(/\d/);
  });
});
