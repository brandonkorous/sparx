import { describe, expect, it } from 'vitest';

import {
  isPaymentTrouble,
  nextStageForModuleActivation,
  nextStageForSubscription,
  subscriptionActivityDescription,
} from './lifecycle';

describe('nextStageForSubscription', () => {
  it('moves a trial to paying when the subscription goes active', () => {
    expect(nextStageForSubscription('trial', 'active')).toBe('paying');
    expect(nextStageForSubscription('activated', 'active')).toBe('paying');
  });

  it('does not re-move a deal already sitting in paying', () => {
    expect(nextStageForSubscription('paying', 'active')).toBeNull();
  });

  it('never drags an advanced deal back to trial', () => {
    // Stripe re-sends subscription.updated for unrelated field changes; a
    // `trialing` status arriving late must not undo activation.
    expect(nextStageForSubscription('activated', 'trialing')).toBeNull();
    expect(nextStageForSubscription('paying', 'trialing')).toBeNull();
    expect(nextStageForSubscription(null, 'trialing')).toBe('trial');
  });

  it('treats an ending subscription as churn only if they ever paid', () => {
    expect(nextStageForSubscription('paying', 'canceled')).toBe('churned');
    expect(nextStageForSubscription('trial', 'canceled')).toBe('trial_expired');
    expect(nextStageForSubscription('activated', 'paused')).toBe('trial_expired');
    expect(nextStageForSubscription('paying', 'paused')).toBe('churned');
    expect(nextStageForSubscription('trial', 'incomplete_expired')).toBe('trial_expired');
  });

  it('leaves an already-closed deal where it is', () => {
    expect(nextStageForSubscription('churned', 'canceled')).toBeNull();
    expect(nextStageForSubscription('trial_expired', 'paused')).toBeNull();
  });

  it('does not move the deal on payment trouble', () => {
    expect(nextStageForSubscription('paying', 'past_due')).toBeNull();
    expect(nextStageForSubscription('paying', 'unpaid')).toBeNull();
  });

  it('ignores statuses it does not model', () => {
    expect(nextStageForSubscription('trial', 'something_new')).toBeNull();
  });
});

describe('nextStageForModuleActivation', () => {
  it('activates out of trial', () => {
    expect(nextStageForModuleActivation('trial')).toBe('activated');
    expect(nextStageForModuleActivation(null)).toBe('activated');
  });

  it('does not regress a paying or already-activated tenant', () => {
    expect(nextStageForModuleActivation('activated')).toBeNull();
    expect(nextStageForModuleActivation('paying')).toBeNull();
    expect(nextStageForModuleActivation('churned')).toBeNull();
  });
});

describe('isPaymentTrouble', () => {
  it('flags the dunning statuses only', () => {
    expect(isPaymentTrouble('past_due')).toBe(true);
    expect(isPaymentTrouble('unpaid')).toBe(true);
    expect(isPaymentTrouble('active')).toBe(false);
    expect(isPaymentTrouble('canceled')).toBe(false);
  });
});

describe('subscriptionActivityDescription', () => {
  it('names the amount when the event carries one', () => {
    expect(subscriptionActivityDescription('active', '$49.00')).toContain('$49.00');
  });

  it('reads as a plain sentence without one', () => {
    expect(subscriptionActivityDescription('active', null)).toBe('Subscription active.');
    expect(subscriptionActivityDescription('paused', null)).toContain('without a card');
  });

  it('falls back to naming an unmodelled status rather than inventing prose', () => {
    expect(subscriptionActivityDescription('weird_status', null)).toContain('weird_status');
  });
});
