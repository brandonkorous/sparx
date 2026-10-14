import { describe, expect, it } from 'vitest';

import { billingNotice } from './notice';

// The trial banner sits on every screen, for everybody on the team. Alyssa, an
// Editor who does the books, was offered "Add payment method", which opened a
// "Set up billing" she was refused on (sparx persona issue 168). The banner still
// tells her the trial is ending: it is news about the business. It tells her who
// can act on it, and offers no button she cannot use.

const trial = (daysLeft: number) => ({ phase: 'trialing', daysLeft }) as never;

describe('the billing banner', () => {
  it('offers the owner the way to pay', () => {
    const notice = billingNotice(trial(7));
    expect(notice?.ctaLabel).toBe('Add payment method');
  });

  it('tells somebody who may not pay who can, with no button', () => {
    const notice = billingNotice(trial(7), false);
    expect(notice?.title).toBe('7 days left in your free trial');
    expect(notice?.body).toMatch(/an owner or an admin/i);
    expect(notice?.ctaLabel).toBeNull();
  });

  it('does so at every rung of the ladder', () => {
    for (const billing of [
      trial(2),
      { phase: 'grace', daysLeft: 5 },
      { phase: 'suspended', daysLeft: 0 },
    ] as never[]) {
      const notice = billingNotice(billing, false);
      expect(notice?.ctaLabel).toBeNull();
      expect(notice?.body).toMatch(/an owner or an admin/i);
    }
  });
});
