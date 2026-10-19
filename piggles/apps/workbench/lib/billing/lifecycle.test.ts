import { describe, expect, it } from 'vitest';
import { lifecycleNotice } from './lifecycle';
import type { BillingPhaseView } from '../../surfaces/finance/bill-data';

// The sentences that tell somebody their business is about to stop working, checked for being TRUE,
// not merely present: a warning that names the wrong cause sends them to fix the wrong thing.

const view = (over: Partial<BillingPhaseView>): BillingPhaseView => ({
  phase: 'trialing',
  daysLeft: 10,
  trialEndsAt: null,
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
    expect(life?.sentence).toContain('ends tomorrow.');
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

describe('somebody who may not pay is told who can, with no button', () => {
  // An Editor was offered "Set up payment" and refused at the account app it
  // opened (sparx persona issue 168). The news still reaches her: it is about
  // the business. The action goes to the people who can take it.
  const phases: BillingPhaseView[] = [
    view({ daysLeft: 12 }),
    view({ daysLeft: 2 }),
    view({ daysLeft: null }),
    view({ phase: 'grace', daysLeft: 5 }),
    view({ phase: 'grace', daysLeft: null }),
    view({ phase: 'suspended', daysLeft: null }),
  ];

  it('still offers the owner the way to pay', () => {
    expect(lifecycleNotice(view({ daysLeft: 12 }))?.action).toBe('Set up payment');
    expect(lifecycleNotice(view({ daysLeft: 12 }), true)?.action).toBe('Set up payment');
  });

  it('names who can act, at every rung, and offers no button', () => {
    for (const billing of phases) {
      const life = lifecycleNotice(billing, false);
      expect(life?.action).toBeNull();
      expect(life?.sentence).toMatch(/an owner or an admin/i);
    }
  });

  it('keeps the same tone and countdown the owner sees', () => {
    for (const billing of phases) {
      const owner = lifecycleNotice(billing);
      const team = lifecycleNotice(billing, false);
      expect(team?.tone).toBe(owner?.tone);
      expect(team?.detail).toBe(owner?.detail);
    }
    expect(lifecycleNotice(view({ daysLeft: 12 }), false)?.sentence).toContain('12 days');
  });

  it('still never names a cause in grace, or invents a number', () => {
    expect(lifecycleNotice(view({ phase: 'grace', daysLeft: 5 }), false)?.sentence).not.toMatch(
      /trial/i
    );
    expect(lifecycleNotice(view({ daysLeft: null }), false)?.sentence).not.toMatch(/\d/);
  });

  it('says nothing to a healthy account either', () => {
    expect(lifecycleNotice(view({ phase: 'active', daysLeft: null }), false)).toBeNull();
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

describe('the countdown, said as a day (issue 272)', () => {
  it('says tomorrow for a trial that ends tomorrow, 25 hours away', () => {
    const now = new Date('2026-10-14T18:00:00Z');
    const billing = {
      phase: 'trialing',
      daysLeft: 2,
      trialEndsAt: '2026-10-15T19:00:00Z',
      suspendsAt: null,
    } as const;
    expect(lifecycleNotice(billing, true, now)?.sentence).toMatch(
      /^Your free trial ends tomorrow\./
    );
  });
});
