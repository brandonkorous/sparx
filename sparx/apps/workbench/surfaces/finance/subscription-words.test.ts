// Your sparx bill, after the trial (sparx persona issue 288).
//
// The day after Gillett's trial ended the bill still read "Free trial ends Oct 15,
// 2026", and on its custom plan it printed the list total as "What you pay sparx".

import { describe, expect, it } from 'vitest';

import { pausedWords, planState, renewalLine } from './subscription-words';

const bill = (over: Record<string, unknown>) =>
  ({
    subscriptionStatus: 'trialing',
    trialEndsAt: '2026-10-15T09:37:43Z',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    planType: 'standard',
    billing: { phase: 'trialing', suspendsAt: '2026-10-22T09:37:43Z' },
    ...over,
  }) as never;

describe('the line under the bill', () => {
  it('counts down while the trial runs', () => {
    expect(renewalLine(bill({}))).toMatch(/^Free trial ends /);
  });

  it('says the trial ended, what is paused and until when the site stays live', () => {
    const line = renewalLine(
      bill({ billing: { phase: 'grace', suspendsAt: '2026-10-22T09:37:43Z' } })
    );
    expect(line).toMatch(/^Your free trial ended /);
    expect(line).toMatch(/paid features are paused/);
    expect(line).toMatch(/website stays live until /);
  });

  it('says the site is offline once grace is over', () => {
    const line = renewalLine(bill({ billing: { phase: 'suspended', suspendsAt: null } }));
    expect(line).toMatch(/website is offline/);
  });

  it('names a failed renewal, not a trial', () => {
    const line = renewalLine(
      bill({ subscriptionStatus: 'past_due', billing: { phase: 'grace', suspendsAt: null } })
    );
    expect(line).toMatch(/^Your last payment did not go through/);
  });

  it('badges a lapsed trial as ended, not as a free trial', () => {
    const lapsed = bill({ planModules: [], billing: { phase: 'grace', suspendsAt: null } });
    expect(planState(lapsed)).toEqual({ label: 'Trial ended', tone: 'warning' });
  });

  it('says nothing about a trial on a custom plan', () => {
    expect(renewalLine(bill({ planType: 'enterprise', billing: { phase: 'exempt' } }))).toBeNull();
  });
});

// The paused pane read "Your sparx bill has not been paid" for a business whose
// trial ran out and whose site went offline: the phase view drops the trial date
// once suspended, and there was never a bill (sparx persona issue 289).
describe('the paused pane gives the same reason as the bill', () => {
  // What the gate hands over once grace is over: no dates on the phase view.
  const offline = { phase: 'suspended', trialEndsAt: null, suspendsAt: null };

  it('says the trial ended, not that a bill went unpaid, once the site is offline', () => {
    const words = pausedWords(bill({ billing: offline }), 'Selling', true);
    expect(words.description).toMatch(/^Your free trial ended /);
    expect(words.description).not.toMatch(/bill has not been paid/);
    expect(words.description).toMatch(/website is offline/);
    expect(renewalLine(bill({ billing: offline }))).toMatch(/^Your free trial ended /);
  });

  it('names a failed renewal', () => {
    const words = pausedWords(
      bill({ subscriptionStatus: 'past_due', billing: offline }),
      'Selling',
      true
    );
    expect(words.description).toMatch(/^Your last payment did not go through\. /);
  });

  it('names a canceled plan, not an old trial', () => {
    const canceled = bill({ subscriptionStatus: 'canceled', billing: offline });
    expect(pausedWords(canceled, 'Selling', true).description).toMatch(
      /^Your plan was canceled\. /
    );
    expect(renewalLine(canceled)).toMatch(/^Your plan was canceled\. /);
  });

  it('falls back to the bill when there is no trial and no failed payment', () => {
    const words = pausedWords(
      bill({ subscriptionStatus: null, trialEndsAt: null, billing: offline }),
      'Selling',
      true
    );
    expect(words.description).toMatch(/^Your sparx bill has not been paid\. /);
  });
});
